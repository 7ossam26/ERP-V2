// controllers/bulk/bulkContractPrice.controller.js
const prisma = require("../../config/database");

// GET /api/bulk/customers/:id/prices
exports.list = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const prices = await prisma.bulkContractPrice.findMany({
      where: { customerId },
      orderBy: { item: { name: "asc" } },
      include: { item: { select: { id: true, name: true, unit: true, price: true } } },
    });
    res.json(prices);
  } catch (err) {
    next(err);
  }
};

function parseEntries(raw) {
  const entries = Array.isArray(raw?.entries) ? raw.entries : null;
  if (!entries) throw Object.assign(new Error("entries[] is required"), { status: 400 });
  const cleaned = [];
  for (const e of entries) {
    const itemId = Number(e?.itemId);
    const price = Number(e?.price);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw Object.assign(new Error("Each entry needs a positive integer itemId"), { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error(`Invalid price for item ${itemId}`), { status: 400 });
    }
    cleaned.push({ itemId, price });
  }
  return cleaned;
}

// PUT /api/bulk/customers/:id/prices
// REPLACES the entire override list — items omitted from entries[] are deleted.
exports.bulkReplace = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const customer = await prisma.bulkCustomer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const cleaned = parseEntries(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Delete all existing overrides, then insert the new set.
      await tx.bulkContractPrice.deleteMany({ where: { customerId } });
      if (cleaned.length === 0) return [];
      const rows = await Promise.all(
        cleaned.map(({ itemId, price }) =>
          tx.bulkContractPrice.create({
            data: { customerId, itemId, price, createdByUserId: req.user?.id ?? null },
          }),
        ),
      );
      return rows;
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

// PATCH /api/bulk/customers/:id/prices
// MERGES — upserts entries[], leaves unlisted overrides untouched.
exports.bulkMerge = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const customer = await prisma.bulkCustomer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const cleaned = parseEntries(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const { itemId, price } of cleaned) {
        const row = await tx.bulkContractPrice.upsert({
          where: { customerId_itemId: { customerId, itemId } },
          create: { customerId, itemId, price, createdByUserId: req.user?.id ?? null },
          update: { price },
        });
        out.push(row);
      }
      return out;
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

// DELETE /api/bulk/customers/:id/prices/:priceId
exports.remove = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const priceId = parseInt(req.params.priceId, 10);
    if (!Number.isFinite(customerId) || !Number.isFinite(priceId)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const row = await prisma.bulkContractPrice.findUnique({ where: { id: priceId } });
    if (!row || row.customerId !== customerId) return res.status(404).json({ error: "Not found" });
    await prisma.bulkContractPrice.delete({ where: { id: priceId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
