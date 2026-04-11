const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const prisma = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

// ── Entity export config ─────────────────────────────────────────────────────
const EXPORT_CONFIG = {
  items: {
    nameAr: "الأصناف",
    arabicRow: ["اسم الصنف *", "سعر البيع *", "سعر التكلفة", "الوحدة * (piece / kg / box)", "حد إعادة الطلب", "يظهر في POS"],
    fetch: () => prisma.item.findMany({ orderBy: { name: "asc" } }),
    toRow: (r) => [r.name, Number(r.price), Number(r.costPrice), r.unit, r.reorderPoint, r.showInPos ? "true" : "false"],
  },
  clients: {
    nameAr: "العملاء",
    arabicRow: ["اسم العميل *", "رقم الهاتف *", "العنوان"],
    fetch: () => prisma.client.findMany({ orderBy: { name: "asc" } }),
    toRow: (r) => [r.name, r.phoneNumber, r.address || ""],
  },
  suppliers: {
    nameAr: "الموردين",
    arabicRow: ["اسم المورد *", "رقم الهاتف *"],
    fetch: () => prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    toRow: (r) => [r.name, r.phoneNumber],
  },
  employees: {
    nameAr: "الموظفين",
    arabicRow: ["الاسم *", "المسمى الوظيفي *", "رقم الفرع *", "رقم الهاتف *", "الرقم القومي", "أيام العمل/شهر", "ساعات العمل/يوم", "يوم الراحة الأسبوعي", "الراتب *"],
    fetch: () => prisma.employee.findMany({ orderBy: { name: "asc" } }),
    toRow: (r) => [r.name, r.position, r.branchId, r.phoneNumber, r.nationalId || "", r.workingDaysPerMonth, Number(r.workingHoursPerDay), r.weeklyHoliday, Number(r.salary)],
  },
  inventory: {
    nameAr: "المخزون",
    arabicRow: ["اسم الصنف *", "اسم المستودع *", "الكمية *"],
    fetch: () => prisma.inventory.findMany({ include: { item: true, warehouse: true }, orderBy: { item: { name: "asc" } } }),
    toRow: (r) => [r.item.name, r.warehouse.name, Number(r.quantity)],
  },
  treasury: {
    nameAr: "الخزائن",
    arabicRow: ["اسم الخزينة *", "الرصيد الافتتاحي"],
    fetch: () => prisma.treasury.findMany({ orderBy: { name: "asc" } }),
    toRow: (r) => [r.name, Number(r.balance)],
  },
};

// ── GET /api/export/:entity ──────────────────────────────────────────────────
router.get("/:entity", authenticateToken, async (req, res) => {
  const cfg = EXPORT_CONFIG[req.params.entity];
  if (!cfg) return res.status(404).json({ error: "Entity not found" });

  try {
    const records = await cfg.fetch();

    const wsData = [cfg.arabicRow, ...records.map(cfg.toRow)];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = cfg.arabicRow.map(() => ({ wch: 28 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.nameAr);

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="export_${req.params.entity}.xlsx"`);
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
