// controllers/bulk/bulkItem.controller.js
// Catalog for the wholesale selling screen.
//
// Why this exists instead of reusing GET /api/items + GET /api/inventory:
//   1. /api/inventory is gated on INVENTORY|POS|INVENTORY_COUNT, which a
//      BULK_POS-only role need not hold — that fetch could 403 and leave the
//      whole grid unclickable with only a toast to explain it.
//   2. Availability is BOM-aware here, so made-to-order products (always zero
//      on-hand) are sellable rather than permanently showing نفد.
//   3. The warehouse is resolved with the same helper the order-create path uses,
//      so the catalog and the order can never disagree about which warehouse
//      the operator is selling from.
const prisma = require("../../config/database");
const { resolveOperatingBranch } = require("../../middleware/auth");
const { buildSellableCatalog } = require("../../lib/sellableCatalog");

// GET /api/bulk/items
exports.listItems = async (req, res, next) => {
  try {
    const branch = await resolveOperatingBranch(req.user.id, req);
    if (!branch) {
      return res.status(400).json({
        error: "Branch selection required",
        message: "برجاء اختيار الفرع أولاً",
      });
    }

    // onlyShowInPos: false — wholesale has always sold from the full item list
    // (raw materials included), and narrowing it here would silently remove
    // items customers order today.
    const items = await buildSellableCatalog(prisma, {
      warehouseId: branch.warehouseId,
      onlyShowInPos: false,
    });

    res.json({ warehouseId: branch.warehouseId, items });
  } catch (err) {
    next(err);
  }
};
