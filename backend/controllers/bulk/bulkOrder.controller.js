// controllers/bulk/bulkOrder.controller.js
const prisma = require("../../config/database");
const { allocateNumber } = require("../../services/bulkNumbering.service");
const { applyBulkOrderStockMovement } = require("../../services/bulkStock.service");
const { assertCreditLimitOk } = require("../../services/bulkCredit.service");
const { recomputeOrderBalance } = require("../../services/bulkPayments.service");

// Flip to 2 when Phase 2 (real payment selection) is ready.
const CURRENT_PHASE = 1;

const DEFAULT_TAX_RATE = 0.14;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function splitInclusive(inclusive, rate) {
  const net = round2(Number(inclusive) / (1 + Number(rate)));
  const tax = round2(Number(inclusive) - net);
  return { net, tax };
}

function computeTotals(lines, taxRate) {
  let subtotal = 0;
  for (const l of lines) subtotal += round2(Number(l.quantity) * Number(l.unitPrice));
  subtotal = round2(subtotal);
  const { net, tax } = splitInclusive(subtotal, taxRate);
  return {
    subtotalInclusive: subtotal,
    netAmount: net,
    taxAmount: tax,
    total: subtotal,
  };
}

function validateLines(rawLines) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    const err = new Error("At least one line item is required");
    err.status = 400;
    throw err;
  }
  const cleaned = [];
  for (const raw of rawLines) {
    const itemId = Number(raw?.itemId);
    const quantity = Number(raw?.quantity);
    const unitPrice = Number(raw?.unitPrice);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      const err = new Error("Each line needs a positive integer itemId");
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error(`Line for item ${itemId} needs a positive quantity`);
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      const err = new Error(`Line for item ${itemId} needs a non-negative unitPrice`);
      err.status = 400;
      throw err;
    }
    cleaned.push({
      itemId,
      quantity,
      unitPrice,
      lineTotal: round2(quantity * unitPrice),
    });
  }
  return cleaned;
}

const orderInclude = {
  customer: { select: { id: true, companyName: true, taxNumber: true, primaryContactPhone: true } },
  warehouse: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: { item: { select: { id: true, name: true, unit: true } } },
    orderBy: { id: "asc" },
  },
  documents: { orderBy: { id: "asc" } },
  payments: {
    include: { treasury: { select: { id: true, name: true } } },
    orderBy: { receivedAt: "asc" },
  },
  refunds: { orderBy: { createdAt: "asc" } },
};

// GET /api/bulk/orders?status=&customerId=&from=&to=
exports.list = async (req, res, next) => {
  try {
    const { status, customerId, from, to } = req.query;
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = parseInt(customerId, 10);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const orders = await prisma.bulkOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, companyName: true } },
        warehouse: { select: { id: true, name: true } },
      },
      take: 200,
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// GET /api/bulk/orders/:id
exports.detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const order = await prisma.bulkOrder.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/orders
// body: { customerId, warehouseId, items: [{itemId, quantity, unitPrice}], status?, notes?, scheduledPickupDate? }
exports.create = async (req, res, next) => {
  try {
    const body = req.body || {};
    const customerId = Number(body.customerId);
    const warehouseId = Number(body.warehouseId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: "customerId is required" });
    }
    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
      return res.status(400).json({ error: "warehouseId is required" });
    }
    const status = body.status === "QUOTED" ? "QUOTED" : "DRAFT";
    const lines = validateLines(body.items);
    const taxRate = body.taxRate != null ? Number(body.taxRate) : DEFAULT_TAX_RATE;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate >= 1) {
      return res.status(400).json({ error: "taxRate must be between 0 and 1" });
    }

    const [customer, warehouse] = await Promise.all([
      prisma.bulkCustomer.findUnique({ where: { id: customerId } }),
      prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    ]);
    if (!customer || !customer.isActive) return res.status(404).json({ error: "Customer not found" });
    if (!warehouse) return res.status(404).json({ error: "Warehouse not found" });

    const totals = computeTotals(lines, taxRate);

    const created = await prisma.bulkOrder.create({
      data: {
        customerId,
        warehouseId,
        createdByUserId: req.user.id,
        status,
        taxRate,
        ...totals,
        balanceDue: totals.total,
        notes: body.notes ?? null,
        scheduledPickupDate: body.scheduledPickupDate ? new Date(body.scheduledPickupDate) : null,
        items: { create: lines },
      },
      include: orderInclude,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/orders/:id/confirm
// Phase 1 supports immediate cash settlement only: body may include
// { paidAmount: number } (defaults to total). Stock is deducted, a
// SALES_RECEIPT document is issued, and the order moves to PAID/PARTIALLY_PAID
// based on paidAmount (Phase 1 has no AR ledger writes — payments arrive in P2).
exports.confirm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.bulkOrder.findUnique({
        where: { id },
        include: { items: true, customer: true },
      });
      if (!order) {
        const err = new Error("Order not found");
        err.status = 404;
        throw err;
      }
      if (order.status !== "DRAFT" && order.status !== "QUOTED") {
        const err = new Error(`Cannot confirm order in status ${order.status}`);
        err.status = 409;
        throw err;
      }

      // Phase 1 gate: tax invoices are deferred to Phase 2.
      if (CURRENT_PHASE < 2 && order.customer.taxNumber) {
        const err = new Error("TAX_INVOICE_NOT_AVAILABLE_IN_PHASE_1");
        err.status = 400;
        err.data = { error: "TAX_INVOICE_NOT_AVAILABLE_IN_PHASE_1",
          message: "Orders for tax-registered customers require Phase 2 to issue a tax invoice" };
        throw err;
      }

      const orderTotal = Number(order.total);
      const now = new Date();

      // Credit check: always assume worst case (full order total added to AR) so
      // a customer at their limit can't slip through by promising partial cash.
      await assertCreditLimitOk(tx, order.customer, orderTotal, order.id);

      // Atomic stock deduction (throws INSUFFICIENT_STOCK if any line short).
      await applyBulkOrderStockMovement(tx, order, "DEBIT");

      const orderNumber = await allocateNumber(tx, "ORDER");
      const documentNumber = await allocateNumber(tx, "SALES_RECEIPT");

      await tx.bulkDocument.create({
        data: {
          orderId: order.id,
          type: "SALES_RECEIPT",
          documentNumber,
          issuedByUserId: req.user.id,
          snapshot: {
            orderNumber,
            docType: "SALES_RECEIPT",
            customer: {
              id: order.customer.id,
              companyName: order.customer.companyName,
              taxNumber: order.customer.taxNumber,
            },
            taxRate: Number(order.taxRate),
            netAmount: Number(order.netAmount),
            taxAmount: Number(order.taxAmount),
            total: orderTotal,
            issuedAt: now.toISOString(),
          },
        },
      });

      // Phase 1: confirm = immediate full cash payment (synthetic BulkPayment).
      // Phase 2 will replace this with a real payment-selection step.
      if (CURRENT_PHASE < 2) {
        await tx.bulkPayment.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            treasuryId: null, // no treasury selection in Phase 1
            method: "CASH",
            amount: orderTotal,
            createdByUserId: req.user.id,
            notes: "Phase-1 implicit settlement",
          },
        });
      }

      // Determine final status from paidAmount (Phase 1 always PAID).
      const paidAmount = CURRENT_PHASE < 2 ? orderTotal : round2(
        req.body?.paidAmount !== undefined ? Number(req.body.paidAmount) : orderTotal,
      );
      const balanceDue = round2(orderTotal - paidAmount);
      let newStatus;
      if (paidAmount === 0) newStatus = "CONFIRMED";
      else if (balanceDue <= 0) newStatus = "PAID";
      else newStatus = "PARTIALLY_PAID";

      const updated = await tx.bulkOrder.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          orderNumber,
          confirmedAt: now,
          paidAmount,
          balanceDue,
          paidAt: balanceDue <= 0 ? now : null,
        },
        include: orderInclude,
      });
      return updated;
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// POST /api/bulk/orders/:id/cancel
exports.cancel = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const reason = (req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "reason is required" });

    const order = await prisma.bulkOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "DRAFT" && order.status !== "QUOTED") {
      return res
        .status(409)
        .json({ error: `Cannot cancel order in status ${order.status}. Use the return flow instead.` });
    }

    const updated = await prisma.bulkOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: req.user.id,
        cancelReason: reason,
      },
      include: orderInclude,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};
