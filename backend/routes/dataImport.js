const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

// ── Multer: memory storage, 10 MB, Excel/CSV only ──────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) return cb(null, true);
    cb(new Error("Only .xlsx / .xls / .csv files are allowed"));
  },
});

// ── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = {
  items: {
    nameAr: "الأصناف",
    arabicRow: ["اسم الصنف *", "سعر البيع *", "سعر التكلفة", "الوحدة * (piece / kg / box)", "حد إعادة الطلب", "يظهر في POS"],
    headerRow: ["name", "price", "costPrice", "unit", "reorderPoint", "showInPos"],
    exampleRow: ["مياه معدنية", 5, 3, "piece", 10, "true"],
  },
  clients: {
    nameAr: "العملاء",
    arabicRow: ["اسم العميل *", "رقم الهاتف *", "العنوان"],
    headerRow: ["name", "phoneNumber", "address"],
    exampleRow: ["أحمد محمد", "01012345678", "القاهرة - مدينة نصر"],
  },
  suppliers: {
    nameAr: "الموردين",
    arabicRow: ["اسم المورد *", "رقم الهاتف *"],
    headerRow: ["name", "phoneNumber"],
    exampleRow: ["شركة النيل للتوريدات", "01098765432"],
  },
  employees: {
    nameAr: "الموظفين",
    arabicRow: ["الاسم *", "المسمى الوظيفي *", "رقم الفرع *", "رقم الهاتف *", "الرقم القومي", "أيام العمل/شهر", "ساعات العمل/يوم", "يوم الراحة الأسبوعي", "الراتب *"],
    headerRow: ["name", "position", "branchId", "phoneNumber", "nationalId", "workingDaysPerMonth", "workingHoursPerDay", "weeklyHoliday", "salary"],
    exampleRow: ["محمد علي", "محاسب", 1, "01123456789", "12345678901234", 26, 8, "الجمعة", 5000],
  },
  inventory: {
    nameAr: "المخزون الافتتاحي",
    arabicRow: ["اسم الصنف *", "اسم المستودع *", "الكمية *"],
    headerRow: ["itemName", "warehouseName", "quantity"],
    exampleRow: ["مياه معدنية", "المستودع الرئيسي", 100],
  },
  treasury: {
    nameAr: "الخزائن",
    arabicRow: ["اسم الخزينة *", "الرصيد الافتتاحي"],
    headerRow: ["name", "balance"],
    exampleRow: ["الخزينة الرئيسية", 10000],
  },
};

// ── Helper: parse uploaded file → array of row objects ──────────────────────
// headers: the ordered field name array from TEMPLATES[entity].headerRow
function parseFile(buffer, headers) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // raw rows as arrays
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (raw.length < 2) throw new Error("الملف لا يحتوي على بيانات كافية (يجب أن يكون هناك صف عناوين وصف بيانات على الأقل)");

  // row index 0 = Arabic header row (skip), row index 1+ = data
  const dataRows = raw.slice(1);

  return dataRows
    .filter((row) => row.some((cell) => cell !== "")) // skip blank rows
    .map((row, i) => {
      const obj = { _rowNum: i + 2 }; // 1-based, skipping 1 header row
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx] : "";
      });
      return obj;
    });
}

// ── GET /api/import/template/:entity ────────────────────────────────────────
router.get("/template/:entity", authenticateToken, (req, res) => {
  const tmpl = TEMPLATES[req.params.entity];
  if (!tmpl) return res.status(404).json({ error: "Entity not found" });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Data template — Row 1: Arabic headers, Row 2: example data
  const wsData = [
    tmpl.arabicRow,
    tmpl.exampleRow,
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = tmpl.arabicRow.map(() => ({ wch: 28 }));

  XLSX.utils.book_append_sheet(wb, ws, tmpl.nameAr);

  // Sheet 2: Instructions in Arabic
  const instructions = [
    ["تعليمات الاستيراد"],
    [""],
    ["الصف الأول: عناوين الأعمدة — لا تعدّل هذا الصف أبداً"],
    ["الصف الثاني فما فوق: أدخل بياناتك هنا (يمكنك حذف صف المثال)"],
    [""],
    ["الحقول المميزة بعلامة * إلزامية"],
    ["showInPos: اكتب true أو false"],
    ["unit (الوحدة): piece = قطعة | kg = كيلو جرام | box = علبة"],
    ["weeklyHoliday: اكتب اسم اليوم بالعربية (مثال: الجمعة)"],
    ["branchId (الموظفين): أدخل رقم الفرع الصحيح من قاعدة البيانات"],
    ["itemName / warehouseName (المخزون): اكتب الاسم كما هو مسجل في النظام"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "تعليمات");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="template_${req.params.entity}.xlsx"`);
  res.send(buf);
});

// ── POST /api/import/items ───────────────────────────────────────────────────
router.post("/items", authenticateToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });
  let rows;
  try { rows = parseFile(req.file.buffer, TEMPLATES.items.headerRow); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const rowNum = row._rowNum;
    const name = String(row.name || "").trim();
    const price = parseFloat(row.price);
    const unit = String(row.unit || "").trim();

    const VALID_UNITS = ["piece", "kg", "box"];
    if (!name) { errors.push({ row: rowNum, reason: "اسم الصنف مطلوب" }); skipped++; continue; }
    if (isNaN(price) || price < 0) { errors.push({ row: rowNum, reason: "سعر البيع غير صالح" }); skipped++; continue; }
    if (!unit) { errors.push({ row: rowNum, reason: "الوحدة مطلوبة" }); skipped++; continue; }
    if (!VALID_UNITS.includes(unit)) { errors.push({ row: rowNum, reason: `الوحدة "${unit}" غير صالحة. القيم المقبولة: piece, kg, box` }); skipped++; continue; }

    try {
      await prisma.item.create({
        data: {
          name,
          price,
          costPrice: parseFloat(row.costPrice) || 0,
          unit,
          reorderPoint: parseInt(row.reorderPoint) || 10,
          showInPos: String(row.showInPos).toLowerCase() !== "false",
        },
      });
      imported++;
    } catch (e) {
      const reason = e.code === "P2002" ? `الصنف "${name}" موجود مسبقاً` : e.message;
      errors.push({ row: rowNum, reason });
      skipped++;
    }
  }

  res.json({ entity: "items", total: rows.length, imported, skipped, errors });
});

// ── POST /api/import/clients ─────────────────────────────────────────────────
router.post("/clients", authenticateToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });
  let rows;
  try { rows = parseFile(req.file.buffer, TEMPLATES.clients.headerRow); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const rowNum = row._rowNum;
    const name = String(row.name || "").trim();
    const phoneNumber = String(row.phoneNumber || "").trim();

    if (!name) { errors.push({ row: rowNum, reason: "اسم العميل مطلوب" }); skipped++; continue; }
    if (!phoneNumber) { errors.push({ row: rowNum, reason: "رقم الهاتف مطلوب" }); skipped++; continue; }

    try {
      await prisma.client.create({
        data: {
          name,
          phoneNumber,
          address: String(row.address || "").trim() || null,
        },
      });
      imported++;
    } catch (e) {
      errors.push({ row: rowNum, reason: e.message });
      skipped++;
    }
  }

  res.json({ entity: "clients", total: rows.length, imported, skipped, errors });
});

// ── POST /api/import/suppliers ───────────────────────────────────────────────
router.post("/suppliers", authenticateToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });
  let rows;
  try { rows = parseFile(req.file.buffer, TEMPLATES.suppliers.headerRow); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const rowNum = row._rowNum;
    const name = String(row.name || "").trim();
    const phoneNumber = String(row.phoneNumber || "").trim();

    if (!name) { errors.push({ row: rowNum, reason: "اسم المورد مطلوب" }); skipped++; continue; }
    if (!phoneNumber) { errors.push({ row: rowNum, reason: "رقم الهاتف مطلوب" }); skipped++; continue; }

    try {
      await prisma.supplier.create({ data: { name, phoneNumber } });
      imported++;
    } catch (e) {
      errors.push({ row: rowNum, reason: e.message });
      skipped++;
    }
  }

  res.json({ entity: "suppliers", total: rows.length, imported, skipped, errors });
});

// ── POST /api/import/employees ───────────────────────────────────────────────
router.post("/employees", authenticateToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });
  let rows;
  try { rows = parseFile(req.file.buffer, TEMPLATES.employees.headerRow); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  let imported = 0, skipped = 0;
  const errors = [];

  // Pre-fetch valid branch IDs
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchIds = new Set(branches.map((b) => b.id));

  for (const row of rows) {
    const rowNum = row._rowNum;
    const name = String(row.name || "").trim();
    const position = String(row.position || "").trim();
    const branchId = parseInt(row.branchId);
    const phoneNumber = String(row.phoneNumber || "").trim();
    const salary = parseFloat(row.salary);

    if (!name) { errors.push({ row: rowNum, reason: "الاسم مطلوب" }); skipped++; continue; }
    if (!position) { errors.push({ row: rowNum, reason: "المسمى الوظيفي مطلوب" }); skipped++; continue; }
    if (isNaN(branchId) || !branchIds.has(branchId)) {
      errors.push({ row: rowNum, reason: `رقم الفرع "${row.branchId}" غير موجود. الفروع المتاحة: ${branches.map(b => `${b.id} (${b.name})`).join(", ")}` });
      skipped++; continue;
    }
    if (!phoneNumber) { errors.push({ row: rowNum, reason: "رقم الهاتف مطلوب" }); skipped++; continue; }
    if (isNaN(salary) || salary < 0) { errors.push({ row: rowNum, reason: "الراتب غير صالح" }); skipped++; continue; }

    try {
      await prisma.employee.create({
        data: {
          name,
          position,
          branchId,
          phoneNumber,
          nationalId: String(row.nationalId || "").trim() || null,
          workingDaysPerMonth: parseInt(row.workingDaysPerMonth) || 26,
          workingHoursPerDay: parseFloat(row.workingHoursPerDay) || 8,
          weeklyHoliday: String(row.weeklyHoliday || "").trim() || "الجمعة",
          salary,
        },
      });
      imported++;
    } catch (e) {
      errors.push({ row: rowNum, reason: e.message });
      skipped++;
    }
  }

  res.json({ entity: "employees", total: rows.length, imported, skipped, errors });
});

// ── POST /api/import/inventory ───────────────────────────────────────────────
router.post("/inventory", authenticateToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });
  let rows;
  try { rows = parseFile(req.file.buffer, TEMPLATES.inventory.headerRow); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  let imported = 0, skipped = 0;
  const errors = [];

  // Pre-fetch items and warehouses for name → id lookup
  const items = await prisma.item.findMany({ select: { id: true, name: true } });
  const warehouses = await prisma.warehouse.findMany({ select: { id: true, name: true } });
  const itemMap = new Map(items.map((i) => [i.name.trim().toLowerCase(), i.id]));
  const warehouseMap = new Map(warehouses.map((w) => [w.name.trim().toLowerCase(), w.id]));

  for (const row of rows) {
    const rowNum = row._rowNum;
    const itemName = String(row.itemName || "").trim();
    const warehouseName = String(row.warehouseName || "").trim();
    const quantity = parseFloat(row.quantity);

    if (!itemName) { errors.push({ row: rowNum, reason: "اسم الصنف مطلوب" }); skipped++; continue; }
    if (!warehouseName) { errors.push({ row: rowNum, reason: "اسم المستودع مطلوب" }); skipped++; continue; }
    if (isNaN(quantity) || quantity < 0) { errors.push({ row: rowNum, reason: "الكمية غير صالحة" }); skipped++; continue; }

    const itemId = itemMap.get(itemName.toLowerCase());
    if (!itemId) { errors.push({ row: rowNum, reason: `الصنف "${itemName}" غير موجود في النظام` }); skipped++; continue; }

    const warehouseId = warehouseMap.get(warehouseName.toLowerCase());
    if (!warehouseId) { errors.push({ row: rowNum, reason: `المستودع "${warehouseName}" غير موجود في النظام` }); skipped++; continue; }

    try {
      await prisma.inventory.upsert({
        where: { itemId_warehouseId: { itemId, warehouseId } },
        update: { quantity },
        create: { itemId, warehouseId, quantity },
      });
      imported++;
    } catch (e) {
      errors.push({ row: rowNum, reason: e.message });
      skipped++;
    }
  }

  res.json({ entity: "inventory", total: rows.length, imported, skipped, errors });
});

// ── POST /api/import/treasury ────────────────────────────────────────────────
router.post("/treasury", authenticateToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });
  let rows;
  try { rows = parseFile(req.file.buffer, TEMPLATES.treasury.headerRow); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const rowNum = row._rowNum;
    const name = String(row.name || "").trim();
    const balance = parseFloat(row.balance) || 0;

    if (!name) { errors.push({ row: rowNum, reason: "اسم الخزينة مطلوب" }); skipped++; continue; }

    try {
      await prisma.treasury.create({ data: { name, balance } });
      imported++;
    } catch (e) {
      const reason = e.code === "P2002" ? `الخزينة "${name}" موجودة مسبقاً` : e.message;
      errors.push({ row: rowNum, reason });
      skipped++;
    }
  }

  res.json({ entity: "treasury", total: rows.length, imported, skipped, errors });
});

// ── GET /api/import/branches — helper to list branches for employee import ──
router.get("/branches", authenticateToken, async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  res.json(branches);
});

module.exports = router;
