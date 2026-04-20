const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("../config/database");
const { authenticateToken, requirePermission } = require("../middleware/auth");
const rollNumberService = require("../services/rollNumberService");
const { generateNumber } = require("../services/numberSequenceService");

// ── Multer: memory storage, 5 MB, Excel/CSV only ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) return cb(null, true);
    cb(new Error("Only .xlsx / .xls / .csv files are allowed"));
  },
});

router.use(authenticateToken);

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES = {
  "fabric-items": {
    nameAr: "أقمشة",
    arabicRow: ["اسم الصنف *", "سعر البيع *", "الوحدة *", "سعر التكلفة", "حد إعادة الطلب", "يظهر في POS"],
    headerRow: ["name", "price", "unit", "costPrice", "reorderPoint", "showInPos"],
    exampleRow: ["قماش قطن أبيض", 150, "متر", 90, 10, "true"],
    dictRows: [["القيم المقبولة لـ showInPos"], ["true"], ["false"]],
  },
  "clothes-items": {
    nameAr: "ملابس",
    arabicRow: ["اسم الصنف *", "سعر البيع *", "الوحدة *", "سعر التكلفة", "حد إعادة الطلب", "يظهر في POS"],
    headerRow: ["name", "price", "unit", "costPrice", "reorderPoint", "showInPos"],
    exampleRow: ["قميص رجالي L", 250, "قطعة", 150, 5, "true"],
    dictRows: [["القيم المقبولة لـ showInPos"], ["true"], ["false"]],
  },
  "accessories": {
    nameAr: "إكسسوار",
    arabicRow: ["اسم الصنف *", "سعر البيع *", "الوحدة *", "سعر التكلفة", "حد إعادة الطلب", "يظهر في POS"],
    headerRow: ["name", "price", "unit", "costPrice", "reorderPoint", "showInPos"],
    exampleRow: ["حزام جلد", 80, "قطعة", 40, 5, "true"],
    dictRows: [["القيم المقبولة لـ showInPos"], ["true"], ["false"]],
  },
  "generic-items": {
    nameAr: "أصناف عامة",
    arabicRow: ["اسم الصنف *", "سعر البيع *", "الوحدة *", "سعر التكلفة", "حد إعادة الطلب", "يظهر في POS"],
    headerRow: ["name", "price", "unit", "costPrice", "reorderPoint", "showInPos"],
    exampleRow: ["صنف متنوع", 50, "قطعة", 30, 10, "true"],
    dictRows: [["القيم المقبولة لـ showInPos"], ["true"], ["false"]],
  },
  clients: {
    nameAr: "عملاء",
    arabicRow: ["اسم العميل *", "رقم الهاتف *", "العنوان", "الشريحة"],
    headerRow: ["name", "phoneNumber", "address", "tier"],
    exampleRow: ["أحمد محمد", "01012345678", "القاهرة", "تجزئة"],
    dictRows: [["القيم المقبولة لـ الشريحة"], ["تجزئة → RETAIL (افتراضي)"], ["جملة → WHOLESALE"]],
  },
  suppliers: {
    nameAr: "موردون",
    arabicRow: ["اسم المورد *", "رقم الهاتف *", "الرقم الضريبي"],
    headerRow: ["name", "phoneNumber", "taxNumber"],
    exampleRow: ["شركة النيل للتوريدات", "01098765432", "123456789"],
    dictRows: [],
  },
  "initial-inventory": {
    nameAr: "مخزون افتتاحي",
    arabicRow: ["اسم الصنف *", "اسم المستودع *", "الكمية *"],
    headerRow: ["itemName", "warehouseName", "quantity"],
    exampleRow: ["قماش قطن أبيض", "المستودع الرئيسي", 100],
    dictRows: [["ملاحظة: يجب استيراد الأصناف أولاً قبل المخزون الافتتاحي"]],
  },
  "fabric-rolls": {
    nameAr: "لفات أقمشة",
    arabicRow: ["اسم الصنف *", "الطول الأصلي (م) *", "كود اللون", "الباركود", "رقم اللفة"],
    headerRow: ["itemName", "originalLength", "colorCode", "barcode", "rollNumber"],
    exampleRow: ["قماش قطن أبيض", 50, "WH001", "", ""],
    dictRows: [["ملاحظة: رقم اللفة والباركود يتولد تلقائياً إذا تُركا فارغَين"]],
  },
  employees: {
    nameAr: "موظفون",
    arabicRow: ["الاسم *", "المسمى الوظيفي *", "رقم الفرع *", "رقم الهاتف *", "الرقم القومي", "أيام العمل/شهر", "ساعات العمل/يوم", "يوم الراحة الأسبوعي", "الراتب *"],
    headerRow: ["name", "position", "branchId", "phoneNumber", "nationalId", "workingDaysPerMonth", "workingHoursPerDay", "weeklyHoliday", "salary"],
    exampleRow: ["محمد علي", "محاسب", 1, "01123456789", "12345678901234", 26, 8, "الجمعة", 5000],
    dictRows: [["يوم الراحة: السبت / الأحد / الاثنين / الثلاثاء / الأربعاء / الخميس / الجمعة"]],
  },
  treasury: {
    nameAr: "خزائن",
    arabicRow: ["اسم الخزينة *", "الرصيد الافتتاحي"],
    headerRow: ["name", "balance"],
    exampleRow: ["الخزينة الرئيسية", 10000],
    dictRows: [],
  },
};

// ── Helper: parse uploaded file → array of row objects ────────────────────────
function parseFile(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (raw.length < 3) throw new Error("الملف لا يحتوي على بيانات كافية (3 صفوف على الأقل مطلوبة)");
  const headers = raw[1].map((h) => String(h).trim());
  return raw.slice(2)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row, i) => {
      const obj = { _rowNum: i + 3 };
      headers.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? row[idx] : ""; });
      return obj;
    });
}

// ── Standard response builder ─────────────────────────────────────────────────
function buildResponse(rows, errors, dryRun, preview) {
  const validRows = rows.length - errors.length;
  const resp = { dryRun: !!dryRun, totalRows: rows.length, validRows, invalidRows: errors.length, errors, preview: preview || [] };
  if (errors.length > 0) resp.message = "يحتوي الملف على أخطاء — قم بإصلاحها قبل الاستيراد";
  return resp;
}

// ── GET /api/imports/templates/:type ─────────────────────────────────────────
router.get("/templates/:type", (req, res) => {
  const tmpl = TEMPLATES[req.params.type];
  if (!tmpl) return res.status(404).json({ error: "نوع الاستيراد غير موجود" });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Data
  const wsData = [tmpl.arabicRow, tmpl.headerRow, tmpl.exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = tmpl.headerRow.map(() => ({ wch: 28 }));
  XLSX.utils.book_append_sheet(wb, ws, tmpl.nameAr);

  // Sheet 2: Dictionary (value mappings)
  if (tmpl.dictRows.length > 0) {
    const wsDict = XLSX.utils.aoa_to_sheet(tmpl.dictRows);
    wsDict["!cols"] = [{ wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsDict, "قاموس");
  }

  // Sheet 3: Instructions
  const instructions = [
    ["تعليمات الاستيراد"],
    [""],
    ["الصف الأول: التسميات العربية (لا تعدّل هذا الصف)"],
    ["الصف الثاني: أسماء الحقول الإنجليزية (لا تعدّل هذا الصف)"],
    ["الصف الثالث فما فوق: أدخل بياناتك هنا"],
    [""],
    ["الحقول المميزة بعلامة * إلزامية"],
    [""],
    ["ترتيب الاستيراد الصحيح:"],
    ["1. خزائن"],
    ["2. موردون"],
    ["3. عملاء"],
    ["4. أصناف (أقمشة / ملابس / إكسسوار / عامة)"],
    ["5. مخزون افتتاحي (يتطلب وجود الأصناف أولاً)"],
    ["6. لفات أقمشة (يتطلب وجود أصناف من نوع قماش أولاً)"],
    ["7. موظفون"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "تعليمات");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''template_${encodeURIComponent(req.params.type)}.xlsx`);
  res.send(buf);
});

// ── Validators ────────────────────────────────────────────────────────────────
async function validateItemRows(rows, itemType) {
  const errors = [];
  const names = new Set();
  const existingItems = await prisma.item.findMany({ select: { name: true } });
  const existingNames = new Set(existingItems.map((i) => i.name.trim()));

  for (const row of rows) {
    const { _rowNum: r } = row;
    const name = String(row.name || "").trim();
    const price = parseFloat(row.price);
    const unit = String(row.unit || "").trim();

    if (!name) { errors.push({ row: r, column: "name", message: "اسم الصنف مطلوب" }); continue; }
    if (names.has(name)) { errors.push({ row: r, column: "name", message: `الصنف "${name}" مكرر في الملف` }); continue; }
    if (existingNames.has(name)) { errors.push({ row: r, column: "name", message: `الصنف "${name}" موجود مسبقاً` }); continue; }
    if (isNaN(price) || price < 0) { errors.push({ row: r, column: "price", message: "سعر البيع غير صالح" }); continue; }
    if (!unit) { errors.push({ row: r, column: "unit", message: "الوحدة مطلوبة" }); continue; }
    names.add(name);
  }
  return errors;
}

async function validateClientRows(rows) {
  const errors = [];
  for (const row of rows) {
    const { _rowNum: r } = row;
    if (!String(row.name || "").trim()) errors.push({ row: r, column: "name", message: "اسم العميل مطلوب" });
    if (!String(row.phoneNumber || "").trim()) errors.push({ row: r, column: "phoneNumber", message: "رقم الهاتف مطلوب" });
  }
  return errors;
}

async function validateSupplierRows(rows) {
  const errors = [];
  for (const row of rows) {
    const { _rowNum: r } = row;
    if (!String(row.name || "").trim()) errors.push({ row: r, column: "name", message: "اسم المورد مطلوب" });
    if (!String(row.phoneNumber || "").trim()) errors.push({ row: r, column: "phoneNumber", message: "رقم الهاتف مطلوب" });
  }
  return errors;
}

async function validateInventoryRows(rows) {
  const errors = [];
  const items = await prisma.item.findMany({ select: { id: true, name: true } });
  const warehouses = await prisma.warehouse.findMany({ select: { id: true, name: true } });
  const itemMap = new Map(items.map((i) => [i.name.trim(), i.id]));
  const warehouseMap = new Map(warehouses.map((w) => [w.name.trim(), w.id]));

  for (const row of rows) {
    const { _rowNum: r } = row;
    const itemName = String(row.itemName || "").trim();
    const warehouseName = String(row.warehouseName || "").trim();
    const quantity = parseFloat(row.quantity);

    if (!itemName) { errors.push({ row: r, column: "itemName", message: "اسم الصنف مطلوب" }); continue; }
    if (!itemMap.has(itemName)) { errors.push({ row: r, column: "itemName", message: `الصنف "${itemName}" غير موجود في النظام` }); continue; }
    if (!warehouseName) { errors.push({ row: r, column: "warehouseName", message: "اسم المستودع مطلوب" }); continue; }
    if (!warehouseMap.has(warehouseName)) { errors.push({ row: r, column: "warehouseName", message: `المستودع "${warehouseName}" غير موجود في النظام` }); continue; }
    if (isNaN(quantity) || quantity < 0) errors.push({ row: r, column: "quantity", message: "الكمية غير صالحة" });
  }
  return errors;
}

async function validateFabricRollRows(rows) {
  const errors = [];
  const items = await prisma.item.findMany({ where: { itemType: "FABRIC" }, select: { id: true, name: true } });
  const itemMap = new Map(items.map((i) => [i.name.trim(), i.id]));
  const existingBarcodes = new Set(
    (await prisma.fabricRoll.findMany({ select: { barcode: true } }))
      .map((r) => r.barcode)
      .filter(Boolean)
  );
  const existingRollNumbers = new Set(
    (await prisma.fabricRoll.findMany({ select: { rollNumber: true } }))
      .map((r) => r.rollNumber)
  );
  const fileBarcodesInFile = new Set();
  const fileRollNumbersInFile = new Set();

  for (const row of rows) {
    const { _rowNum: r } = row;
    const itemName = String(row.itemName || "").trim();
    const originalLength = parseFloat(row.originalLength);
    const barcode = String(row.barcode || "").trim();
    const rollNumber = String(row.rollNumber || "").trim();

    if (!itemName) { errors.push({ row: r, column: "itemName", message: "اسم الصنف مطلوب" }); continue; }
    if (!itemMap.has(itemName)) { errors.push({ row: r, column: "itemName", message: `الصنف "${itemName}" غير موجود أو ليس من نوع قماش` }); continue; }
    if (isNaN(originalLength) || originalLength <= 0) { errors.push({ row: r, column: "originalLength", message: "الطول الأصلي يجب أن يكون أكبر من صفر" }); continue; }
    if (barcode) {
      if (existingBarcodes.has(barcode) || fileBarcodesInFile.has(barcode)) {
        errors.push({ row: r, column: "barcode", message: `الباركود "${barcode}" مستخدم مسبقاً` });
        continue;
      }
      fileBarcodesInFile.add(barcode);
    }
    if (rollNumber) {
      if (existingRollNumbers.has(rollNumber) || fileRollNumbersInFile.has(rollNumber)) {
        errors.push({ row: r, column: "rollNumber", message: `رقم اللفة "${rollNumber}" مستخدم مسبقاً` });
        continue;
      }
      fileRollNumbersInFile.add(rollNumber);
    }
  }
  return errors;
}

async function validateEmployeeRows(rows) {
  const errors = [];
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchIds = new Set(branches.map((b) => b.id));
  const branchList = branches.map((b) => `${b.id} (${b.name})`).join(", ");

  for (const row of rows) {
    const { _rowNum: r } = row;
    if (!String(row.name || "").trim()) errors.push({ row: r, column: "name", message: "الاسم مطلوب" });
    if (!String(row.position || "").trim()) errors.push({ row: r, column: "position", message: "المسمى الوظيفي مطلوب" });
    const branchId = parseInt(row.branchId);
    if (isNaN(branchId) || !branchIds.has(branchId)) {
      errors.push({ row: r, column: "branchId", message: `رقم الفرع "${row.branchId}" غير موجود. الفروع المتاحة: ${branchList}` });
    }
    if (!String(row.phoneNumber || "").trim()) errors.push({ row: r, column: "phoneNumber", message: "رقم الهاتف مطلوب" });
    const salary = parseFloat(row.salary);
    if (isNaN(salary) || salary < 0) errors.push({ row: r, column: "salary", message: "الراتب غير صالح" });
  }
  return errors;
}

async function validateTreasuryRows(rows) {
  const errors = [];
  for (const row of rows) {
    const { _rowNum: r } = row;
    if (!String(row.name || "").trim()) errors.push({ row: r, column: "name", message: "اسم الخزينة مطلوب" });
  }
  return errors;
}

// ── Commit helpers ────────────────────────────────────────────────────────────
function mapTier(val) {
  const v = String(val || "").trim();
  if (v === "جملة") return "WHOLESALE";
  return "RETAIL";
}

// ── POST /api/imports/:type ───────────────────────────────────────────────────
router.post("/:type", requirePermission("INITIAL_INVENTORY"), upload.single("file"), async (req, res) => {
  const { type } = req.params;
  const dryRun = req.query.dryRun === "true";

  if (!req.file) return res.status(400).json({ error: "لم يتم رفع أي ملف" });

  let rows;
  try { rows = parseFile(req.file.buffer); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  if (rows.length === 0) return res.status(400).json({ error: "الملف لا يحتوي على بيانات" });
  if (rows.length > 5000) return res.status(400).json({ error: "الحد الأقصى 5000 صف لكل ملف" });

  let errors = [];

  try {
    // Validate
    const itemTypeMap = { "fabric-items": "FABRIC", "clothes-items": "CLOTHES", "accessories": "ACCESSORY", "generic-items": "GENERIC" };

    if (["fabric-items", "clothes-items", "accessories", "generic-items"].includes(type)) {
      errors = await validateItemRows(rows, itemTypeMap[type]);
    } else if (type === "clients") {
      errors = await validateClientRows(rows);
    } else if (type === "suppliers") {
      errors = await validateSupplierRows(rows);
    } else if (type === "initial-inventory") {
      errors = await validateInventoryRows(rows);
    } else if (type === "fabric-rolls") {
      errors = await validateFabricRollRows(rows);
    } else if (type === "employees") {
      errors = await validateEmployeeRows(rows);
    } else if (type === "treasury") {
      errors = await validateTreasuryRows(rows);
    } else {
      return res.status(404).json({ error: "نوع الاستيراد غير مدعوم" });
    }

    const preview = rows.slice(0, 5).map((r) => { const { _rowNum, ...rest } = r; return rest; });
    const respBase = buildResponse(rows, errors, dryRun, preview);

    if (errors.length > 0 || dryRun) {
      return res.json({ ...respBase, committed: false });
    }

    // Commit
    await prisma.$transaction(async (tx) => {
      if (["fabric-items", "clothes-items", "accessories", "generic-items"].includes(type)) {
        const iType = itemTypeMap[type];
        await tx.item.createMany({
          data: rows.map((row) => ({
            name: String(row.name).trim(),
            price: parseFloat(row.price),
            costPrice: parseFloat(row.costPrice) || 0,
            unit: String(row.unit).trim(),
            reorderPoint: parseInt(row.reorderPoint) || 10,
            showInPos: String(row.showInPos).toLowerCase() !== "false",
            itemType: iType,
          })),
          skipDuplicates: true,
        });

      } else if (type === "clients") {
        await tx.client.createMany({
          data: rows.map((row) => ({
            name: String(row.name).trim(),
            phoneNumber: String(row.phoneNumber).trim(),
            address: String(row.address || "").trim() || null,
            tier: mapTier(row.tier),
          })),
          skipDuplicates: true,
        });

      } else if (type === "suppliers") {
        await tx.supplier.createMany({
          data: rows.map((row) => ({
            name: String(row.name).trim(),
            phoneNumber: String(row.phoneNumber).trim(),
            taxNumber: String(row.taxNumber || "").trim(),
          })),
          skipDuplicates: true,
        });

      } else if (type === "initial-inventory") {
        const items = await tx.item.findMany({ select: { id: true, name: true } });
        const warehouses = await tx.warehouse.findMany({ select: { id: true, name: true } });
        const itemMap = new Map(items.map((i) => [i.name.trim(), i.id]));
        const warehouseMap = new Map(warehouses.map((w) => [w.name.trim(), w]));

        for (const row of rows) {
          const itemId = itemMap.get(String(row.itemName).trim());
          const warehouse = warehouseMap.get(String(row.warehouseName).trim());
          const quantity = parseFloat(row.quantity);

          // Upsert inventory
          await tx.inventory.upsert({
            where: { itemId_warehouseId: { itemId, warehouseId: warehouse.id } },
            update: { quantity },
            create: { itemId, warehouseId: warehouse.id, quantity },
          });

          // Find the branch that owns this warehouse
          const branch = await tx.branch.findFirst({
            where: { warehouseId: warehouse.id },
            select: { id: true },
          });

          if (branch) {
            // Generate unique adjustment number
            const adjNumber = await generateNumber("ADJ", tx);

            // Create adjustment record (IN direction = opening stock)
            const adjustment = await tx.inventoryAdjustment.create({
              data: {
                adjustmentNumber: adjNumber,
                warehouseId: warehouse.id,
                direction: "IN",
                reasonCode: "OTHER",
                reasonNote: "استيراد الرصيد الابتدائي",
                userId: req.user.id,
                branchId: branch.id,
              },
            });

            // Create adjustment item
            await tx.inventoryAdjustmentItem.create({
              data: {
                adjustmentId: adjustment.id,
                itemId,
                quantity,
                unitCostAtTime: 0,
              },
            });
          }
        }

      } else if (type === "fabric-rolls") {
        const items = await tx.item.findMany({ where: { itemType: "FABRIC" }, select: { id: true, name: true } });
        const itemMap = new Map(items.map((i) => [i.name.trim(), i.id]));

        // Get the default warehouse (first available)
        const defaultWarehouse = await tx.warehouse.findFirst({ select: { id: true } });

        for (const row of rows) {
          const itemId = itemMap.get(String(row.itemName).trim());
          const originalLength = parseFloat(row.originalLength);
          const rollNumber = String(row.rollNumber || "").trim() || await rollNumberService.generateRollNumber();
          const barcode = String(row.barcode || "").trim() || null;
          const colorCode = String(row.colorCode || "").trim() || null;

          await tx.fabricRoll.create({
            data: {
              itemId,
              rollNumber,
              barcode,
              colorCode,
              originalLength,
              remainingLength: originalLength,
              // lengthMeters required field — set same as originalLength for compatibility
              lengthMeters: originalLength,
              status: "AVAILABLE",
              warehouseId: defaultWarehouse ? defaultWarehouse.id : 1,
            },
          });

          // Update inventory
          if (defaultWarehouse) {
            await tx.inventory.upsert({
              where: { itemId_warehouseId: { itemId, warehouseId: defaultWarehouse.id } },
              update: { quantity: { increment: originalLength } },
              create: { itemId, warehouseId: defaultWarehouse.id, quantity: originalLength },
            });
          }
        }

      } else if (type === "employees") {
        await tx.employee.createMany({
          data: rows.map((row) => ({
            name: String(row.name).trim(),
            position: String(row.position).trim(),
            branchId: parseInt(row.branchId),
            phoneNumber: String(row.phoneNumber).trim(),
            nationalId: String(row.nationalId || "").trim() || null,
            workingDaysPerMonth: parseInt(row.workingDaysPerMonth) || 26,
            workingHoursPerDay: parseFloat(row.workingHoursPerDay) || 8,
            weeklyHoliday: String(row.weeklyHoliday || "").trim() || "الجمعة",
            salary: parseFloat(row.salary),
          })),
          skipDuplicates: true,
        });

      } else if (type === "treasury") {
        await tx.treasury.createMany({
          data: rows.map((row) => ({
            name: String(row.name).trim(),
            balance: parseFloat(row.balance) || 0,
          })),
          skipDuplicates: true,
        });
      }
    }, { timeout: 30000 });

    res.json({ ...buildResponse(rows, errors, dryRun, []), committed: true });
  } catch (err) {
    console.error(`Import error [${type}]:`, err);
    res.status(500).json({ error: "فشل الاستيراد", details: err.message });
  }
});

// ── POST /api/imports/backfill-item-types ─────────────────────────────────────
router.post("/backfill-item-types", async (req, res) => {
  if (!["Superadmin", "Admin", "Owner"].includes(req.user.role)) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  try {
    const items = await prisma.item.findMany({
      where: { itemType: "GENERIC" },
      include: { fabricRolls: { select: { id: true }, take: 1 } },
    });
    let updated = 0, skipped = 0;
    for (const item of items) {
      if (item.fabricRolls.length > 0) {
        await prisma.item.update({ where: { id: item.id }, data: { itemType: "FABRIC" } });
        updated++;
      } else {
        skipped++;
      }
    }
    res.json({ updated, skipped });
  } catch (err) {
    console.error("Backfill error:", err);
    res.status(500).json({ error: "فشل التحديث", details: err.message });
  }
});

// ── GET /api/imports/branches — helper ───────────────────────────────────────
router.get("/branches", async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  res.json(branches);
});

module.exports = router;
