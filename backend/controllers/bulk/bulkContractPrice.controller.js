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

// PUT /api/bulk/customers/:id/prices
// body: { entries: [{ itemId, price }, ...] }   — bulk upsert
exports.bulkUpsert = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const customer = await prisma.bulkCustomer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
    if (!entries) return res.status(400).json({ error: "entries[] is required" });

    const cleaned = [];
    for (const raw of entries) {
      const itemId = Number(raw?.itemId);
      const price = Number(raw?.price);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ error: "Each entry needs a positive integer itemId" });
      }
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: `Invalid price for item ${itemId}` });
      }
      cleaned.push({ itemId, price });
    }

    const result = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const { itemId, price } of cleaned) {
        const row = await tx.bulkContractPrice.upsert({
          where: { customerId_itemId: { customerId, itemId } },
          create: {
            customerId,
            itemId,
            price,
            createdByUserId: req.user?.id ?? null,
          },
          update: { price },
        });
        out.push(row);
      }
      return out;
    });
    res.json(result);
  } catch (err) {
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
