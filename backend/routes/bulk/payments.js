// routes/bulk/payments.js — standalone endpoints for payment void
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkPayment.controller");

router.use(authenticateToken, requirePermission("BULK_POS"));

// Void a payment by its own id (POST /api/bulk/payments/:id/void)
router.post("/:id/void", ctrl.void);

module.exports = router;
