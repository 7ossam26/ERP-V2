/**
 * stockWriteOff.controller.js — إهلاك
 *
 * Thin HTTP layer. All stock and money logic lives in
 * services/stockWriteOff.service.js so it can be tested without Express.
 */

const prisma = require("../config/database");
const { getUserBranchFilter } = require("../middleware/auth");
const { listWriteOffReasons } = require("../config/writeOffReasons");
const { cairoTodayISO } = require("../utils/dateRange");
const service = require("../services/stockWriteOff.service");

// Reversing an إهلاك puts stock back and unwinds recognised COGS, so it is held
// to a higher bar than recording one — mirroring the manager-level gate on
// returns rather than letting anyone with STOCK_WRITE_OFF undo history.
const REVERSAL_ROLES = new Set(["Superadmin", "Admin"]);

/**
 * The warehouses this user may act on.
 *
 * Uses getUserBranchFilter rather than resolveOperatingBranch because a central
 * / production warehouse has no branch at all, and resolveOperatingBranch can
 * only ever answer with a branch's own warehouse. Global roles get `null` =
 * unrestricted, which is what makes the central-store case reachable.
 *
 * @returns {Promise<number[]|null>} null = any warehouse
 */
async function allowedWarehouseIds(userId) {
  const filter = await getUserBranchFilter(userId);
  if (filter === null) return null; // global role

  const branchIds = filter.id && filter.id.in ? filter.id.in : [filter.id];
  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds } },
    select: { warehouseId: true },
  });
  return branches.map((b) => b.warehouseId).filter((id) => id != null);
}

/** Translate a service error into its HTTP response; rethrow anything else. */
function sendServiceError(res, err) {
  if (err instanceof service.WriteOffError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  throw err;
}

/** GET /api/stock-writeoffs/reasons */
exports.reasons = async (_req, res) => {
  res.json({ reasons: listWriteOffReasons() });
};

/** GET /api/stock-writeoffs?warehouseId= */
exports.listItems = async (req, res) => {
  try {
    const allowed = await allowedWarehouseIds(req.user.id);
    const requested = req.query.warehouseId ? parseInt(req.query.warehouseId, 10) : null;

    if (requested && allowed && !allowed.includes(requested)) {
      return res.status(403).json({ error: "لا يمكنك عرض هذا المخزن" });
    }

    const items = await service.listWriteOffItems({ warehouseId: requested });
    res.json({ warehouseId: requested, items });
  } catch (error) {
    console.error("❌ [WRITE-OFF] listItems:", error);
    res.status(500).json({ error: "فشل تحميل الأصناف", details: error.message });
  }
};

/** GET /api/stock-writeoffs/summary?startDate=&endDate=&warehouseId= */
exports.summary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const allowed = await allowedWarehouseIds(req.user.id);
    const requested = req.query.warehouseId ? parseInt(req.query.warehouseId, 10) : null;

    if (requested && allowed && !allowed.includes(requested)) {
      return res.status(403).json({ error: "لا يمكنك عرض هذا المخزن" });
    }

    // Narrowest scope wins: an explicit warehouse if given, otherwise the
    // caller's own set, otherwise (global role, no filter) everything.
    const warehouseIds = requested ? [requested] : allowed;

    const result = await service.summarize({
      startDate: startDate || cairoTodayISO(),
      endDate: endDate || cairoTodayISO(),
      warehouseIds,
    });
    res.json(result);
  } catch (error) {
    console.error("❌ [WRITE-OFF] summary:", error);
    res.status(500).json({ error: "فشل تحميل الملخص", details: error.message });
  }
};

/** GET /api/stock-writeoffs/item/:itemId?warehouseId= */
exports.itemHistory = async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: "رقم الصنف غير صحيح" });
    }

    const allowed = await allowedWarehouseIds(req.user.id);
    const requested = req.query.warehouseId ? parseInt(req.query.warehouseId, 10) : null;

    if (requested && allowed && !allowed.includes(requested)) {
      return res.status(403).json({ error: "لا يمكنك عرض هذا المخزن" });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, name: true, unit: true, costPrice: true, isBom: true },
    });
    if (!item) return res.status(404).json({ error: "الصنف غير موجود" });

    const entries = await service.listItemHistory({ itemId, warehouseId: requested });
    res.json({ item: { ...item, costPrice: Number(item.costPrice) }, entries });
  } catch (error) {
    console.error("❌ [WRITE-OFF] itemHistory:", error);
    res.status(500).json({ error: "فشل تحميل السجل", details: error.message });
  }
};

/** POST /api/stock-writeoffs */
exports.create = async (req, res) => {
  try {
    const warehouseId = parseInt(req.body.warehouseId, 10);
    const allowed = await allowedWarehouseIds(req.user.id);
    if (allowed && !allowed.includes(warehouseId)) {
      return res.status(403).json({ error: "لا يمكنك تسجيل إهلاك على هذا المخزن" });
    }

    // Only used to tag the audit row; the write itself is warehouse-scoped.
    const branch = await prisma.branch.findFirst({
      where: { warehouseId },
      select: { id: true },
    });

    const entry = await service.createWriteOff(req.body, {
      userId: req.user.id,
      branchId: branch ? branch.id : null,
      ipAddress: req.ip,
    });

    res.status(201).json({ message: "تم تسجيل الإهلاك بنجاح", entry });
  } catch (error) {
    try {
      return sendServiceError(res, error);
    } catch (unexpected) {
      console.error("❌ [WRITE-OFF] create:", unexpected);
      return res
        .status(500)
        .json({ error: "فشل تسجيل الإهلاك", details: unexpected.message });
    }
  }
};

/** POST /api/stock-writeoffs/:id/reverse */
exports.reverse = async (req, res) => {
  try {
    if (!REVERSAL_ROLES.has(req.user.role)) {
      return res
        .status(403)
        .json({ error: "عكس قيود الإهلاك متاح للمديرين فقط" });
    }

    const contra = await service.reverseWriteOff(req.params.id, {
      userId: req.user.id,
      ipAddress: req.ip,
      notes: req.body ? req.body.notes : null,
    });

    res.status(201).json({ message: "تم عكس قيد الإهلاك", entry: contra });
  } catch (error) {
    try {
      return sendServiceError(res, error);
    } catch (unexpected) {
      console.error("❌ [WRITE-OFF] reverse:", unexpected);
      return res
        .status(500)
        .json({ error: "فشل عكس القيد", details: unexpected.message });
    }
  }
};
