// controllers/bulk/bulkOrder.controller.js
const prisma = require("../../config/database");
const { allocateNumber } = require("../../services/bulkNumbering.service");
const { applyBulkOrderStockMovement } = require("../../services/bulkStock.service");
const { assertCreditLimitOk } = require("../../services/bulkCredit.service");
const { recomputeOrderBalance } = require("../../services/bulkPayments.service");
const { writeAudit } = require("../../utils/auditLogger");

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

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

    // Prefer taxRate from the request body (client already fetched it from settings).
    // Fall back to SystemConfiguration, then to DEFAULT_TAX_RATE.
    let taxRate;
    if (body.taxRate != null) {
      taxRate = Number(body.taxRate);
    } else {
      const cfg = await prisma.systemConfiguration.findFirst();
      taxRate = cfg?.taxRate != null ? Number(cfg.taxRate) / 100 : DEFAULT_TAX_RATE;
    }
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

      const orderTotal = Number(order.total);
      const now = new Date();

      // Resolve payment intent first so the credit check can use the real exposure.
      // Confirm respects the caller's paidAmount:
      //   0           → CONFIRMED (open credit, settle later via BulkPaymentModal)
      //   full total  → PAID
      //   partial     → PARTIALLY_PAID
      const paidAmount = round2(
        req.body?.paidAmount !== undefined ? Number(req.body.paidAmount) : orderTotal,
      );

      // Payment details — passed by BulkConfirmOrderModal; fall back to safe defaults
      // so old callers that send only { paidAmount: 0 } continue to work.
      const methodRaw = (req.body?.method || "CASH").toUpperCase();
      const method = paidAmount <= 0 ? "CREDIT" : methodRaw;

      // Credit check: only the unpaid remainder adds to the customer's AR.
      // Cash/cheque/bank payments are committed atomically in this same transaction,
      // so they reduce the real credit exposure immediately.
      const creditExposure = round2(orderTotal - paidAmount);
      await assertCreditLimitOk(tx, order.customer, creditExposure, order.id);

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
      const treasuryId = req.body?.treasuryId ? Number(req.body.treasuryId) : null;
      const bankReference = req.body?.bankReference?.trim() || null;
      const chequeNumber = req.body?.chequeNumber?.trim() || null;
      const chequeDueDate = req.body?.chequeDueDate ? new Date(req.body.chequeDueDate) : null;
      const paymentNotes = req.body?.notes?.trim() || null;

      if (paidAmount > 0 && method !== "CREDIT") {
        if (!treasuryId) {
          const err = new Error("يجب تحديد الخزينة عند الدفع النقدي أو بالشيك أو بالتحويل");
          err.status = 400;
          throw err;
        }
        if (method === "CHEQUE") {
          if (!chequeNumber) {
            const err = new Error("رقم الشيك مطلوب");
            err.status = 400;
            throw err;
          }
          if (!chequeDueDate) {
            const err = new Error("تاريخ استحقاق الشيك مطلوب");
            err.status = 400;
            throw err;
          }
        }
      }

      let payment = null;
      let treasuryBefore = null;
      let treasuryAfter  = null;
      let treasuryMoved  = false;

      if (paidAmount > 0) {
        payment = await tx.bulkPayment.create({
          data: {
            orderId: order.id,
            customerId: order.customerId,
            treasuryId,
            method,
            amount: paidAmount,
            bankReference,
            chequeNumber,
            chequeDueDate,
            createdByUserId: req.user.id,
            notes: paymentNotes || "تسوية عند التأكيد",
          },
        });

        // The dedicated bulkPayments.service.createPayment() helper would do
        // this for us, but the order-confirm flow is already inside its own
        // transaction and createPayment opens its own — so we mirror the
        // treasury-increment rule inline. Keep this in sync with the
        // CASH_METHODS set in services/bulkPayments.service.js.
        const CASH_METHODS = new Set(["CASH", "BANK_TRANSFER", "CHEQUE"]);
        if (CASH_METHODS.has(method) && treasuryId) {
          // Snapshot before/after so we can audit the exact movement and the
          // resulting balance — without this the audit row only carries the
          // delta and an external reader can't see what the till looked like
          // at the moment of the increment.
          const before = await tx.treasury.findUnique({
            where: { id: treasuryId },
            select: { id: true, name: true, balance: true },
          });
          treasuryBefore = before;

          const after = await tx.treasury.update({
            where: { id: treasuryId },
            data: { balance: { increment: paidAmount } },
            select: { id: true, name: true, balance: true },
          });
          treasuryAfter = after;
          treasuryMoved = true;
        }
      }
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

      // Pre-state of the order for audit oldValues — read from the original
      // findUnique above (cheaper than a re-fetch).
      const orderBefore = {
        id: order.id,
        status: order.status,
        total: orderTotal,
        paidAmount: Number(order.paidAmount || 0),
        balanceDue: Number(order.balanceDue || 0),
      };

      return {
        updated,
        payment,
        treasuryBefore,
        treasuryAfter,
        treasuryMoved,
        method,
        paidAmount,
        orderBefore,
        documentNumber,
      };
    });

    // ─── post-commit side effects: console log + audit trail ────────────────
    // writeAudit uses the global prisma client (intentional — audit must
    // outlive a parent tx, but we ALSO must not write audits for a tx that
    // rolled back, so this runs only after $transaction resolves).
    const ip = clientIp(req);
    const actorId = req.user?.id ?? null;
    const branchId = req.user?.branch?.id ?? req.user?.branchId ?? null;

    console.log(
      `[bulk-order] confirm #${result.updated.orderNumber} ` +
      `by user=${actorId} status=${result.orderBefore.status}→${result.updated.status} ` +
      `total=${Number(result.updated.total)} paid=${result.paidAmount} method=${result.method}`,
    );

    // Audit: order confirmation (status transition + financial snapshot).
    writeAudit({
      action: "CONFIRM",
      targetEntity: "bulk_order",
      targetId: result.updated.id,
      userId: actorId,
      branchId,
      oldValues: result.orderBefore,
      newValues: {
        status: result.updated.status,
        orderNumber: result.updated.orderNumber,
        total: Number(result.updated.total),
        paidAmount: result.paidAmount,
        balanceDue: Number(result.updated.balanceDue),
        method: result.method,
        documentNumber: result.documentNumber,
        treasuryId: result.payment?.treasuryId ?? null,
      },
      ipAddress: ip,
    }).catch(() => {});

    // Audit: payment row (only when one was actually created).
    if (result.payment) {
      writeAudit({
        action: "CREATE",
        targetEntity: "bulk_payment",
        targetId: result.payment.id,
        userId: actorId,
        branchId,
        oldValues: null,
        newValues: {
          orderId: result.payment.orderId,
          customerId: result.payment.customerId,
          treasuryId: result.payment.treasuryId,
          method: result.payment.method,
          amount: Number(result.payment.amount),
          bankReference: result.payment.bankReference,
          chequeNumber: result.payment.chequeNumber,
        },
        ipAddress: ip,
      }).catch(() => {});
    }

    // Audit: treasury balance movement — ONLY when cash actually flowed.
    // This is the row that the missing-treasury-increment bug would have
    // hidden; surfacing it here makes future regressions visible immediately.
    if (result.treasuryMoved) {
      console.log(
        `[treasury] credit treasury=${result.treasuryAfter.id} (${result.treasuryAfter.name}) ` +
        `+${result.paidAmount} (bulk-order #${result.updated.orderNumber}) ` +
        `${Number(result.treasuryBefore.balance)}→${Number(result.treasuryAfter.balance)}`,
      );
      writeAudit({
        action: "UPDATE",
        targetEntity: "treasury",
        targetId: result.treasuryAfter.id,
        userId: actorId,
        branchId,
        oldValues: { balance: Number(result.treasuryBefore.balance) },
        newValues: {
          balance: Number(result.treasuryAfter.balance),
          delta: result.paidAmount,
          reason: "bulk_order_confirm",
          orderId: result.updated.id,
          orderNumber: result.updated.orderNumber,
          paymentId: result.payment?.id ?? null,
          method: result.method,
        },
        ipAddress: ip,
      }).catch(() => {});
    }

    res.json(result.updated);
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
