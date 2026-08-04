// routes/bulk/orders.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission, requireAnyPermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkOrder.controller");
const paymentCtrl = require("../../controllers/bulk/bulkPayment.controller");
const refundCtrl = require("../../controllers/bulk/bulkRefund.controller");

router.use(authenticateToken, requirePermission("BULK_POS"));

router.get("/", ctrl.list);
router.get("/:id", ctrl.detail);
router.post("/", ctrl.create);
router.post("/:id/confirm", ctrl.confirm);
router.post("/:id/cancel", ctrl.cancel);
// Returns used to prompt for a manager's username and password on every call.
// That gate now lives in the permission system instead: whoever holds
// SALES_RETURNS can execute a return directly, and whoever does not cannot
// reach it at all. Same set of people, one less password prompt on a screen
// staff use daily.
//
// The money-side protection did NOT move here — a cash refund is still capped
// at what the order was actually paid, inside createReturn. That cap is what
// stops the double-reversal that cost خزينة الإدارة 11,800 on BULK-0025; a
// password prompt never would have, because the manager approved it.
router.post("/:id/return", requireAnyPermission(["SALES_RETURNS"]), refundCtrl.createReturn);
router.get("/:id/payments", paymentCtrl.listByOrder);
router.post("/:id/payments", paymentCtrl.create);

module.exports = router;
