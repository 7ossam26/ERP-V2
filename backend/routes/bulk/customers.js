// routes/bulk/customers.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requireAnyPermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkCustomer.controller");

// BULK_POS reps need read access; BULK_CUSTOMERS gates writes.
const READ_PERMS = ["BULK_POS", "BULK_CUSTOMERS"];
const WRITE_PERMS = ["BULK_CUSTOMERS"];

const paymentCtrl = require("../../controllers/bulk/bulkPayment.controller");
const { createCustomerPayment, createOldDebtPayment } = require("../../services/bulkPayments.service");
const prisma = require("../../config/database");

router.use(authenticateToken);

router.get("/", requireAnyPermission(READ_PERMS), ctrl.list);
router.get("/:id", requireAnyPermission(READ_PERMS), ctrl.detail);
router.post("/", requireAnyPermission(WRITE_PERMS), ctrl.create);
router.patch("/:id", requireAnyPermission(WRITE_PERMS), ctrl.update);
router.post("/:id/contacts", requireAnyPermission(WRITE_PERMS), ctrl.addContact);
router.delete("/:id/contacts/:contactId", requireAnyPermission(WRITE_PERMS), ctrl.removeContact);
router.get("/:id/payments", requireAnyPermission(READ_PERMS), paymentCtrl.listByCustomer);

// POST /api/bulk/customers/:id/payments  — general payment distributed to oldest unpaid orders
router.post("/:id/payments", requireAnyPermission(WRITE_PERMS), async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const payments = await createCustomerPayment(
      prisma,
      customerId,
      req.body,
      req.user.id,
      { ipAddress },
    );
    res.status(201).json(payments);
  } catch (err) {
    next(err);
  }
});

// POST /api/bulk/customers/:id/old-debt  — record a pre-existing debt (no order, no treasury)
router.post("/:id/old-debt", requireAnyPermission(WRITE_PERMS), async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!Number.isFinite(customerId)) return res.status(400).json({ error: "Invalid id" });
    const payment = await createOldDebtPayment(prisma, customerId, req.body, req.user.id);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
