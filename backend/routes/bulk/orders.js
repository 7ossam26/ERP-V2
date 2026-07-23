// routes/bulk/orders.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkOrder.controller");
const paymentCtrl = require("../../controllers/bulk/bulkPayment.controller");
const refundCtrl = require("../../controllers/bulk/bulkRefund.controller");

router.use(authenticateToken, requirePermission("BULK_POS"));

router.get("/", ctrl.list);
router.get("/:id", ctrl.detail);
router.post("/", ctrl.create);
router.post("/:id/confirm", ctrl.confirm);
router.post("/:id/cancel", ctrl.cancel);
// Reachable by any BULK_POS user so an employee can prepare the return; the
// controller gates EXECUTION on verifyManagerApproval(SALES_RETURNS), which
// re-checks the approver's password, role and permission on every call.
router.post("/:id/return", refundCtrl.createReturn);
router.get("/:id/payments", paymentCtrl.listByOrder);
router.post("/:id/payments", paymentCtrl.create);

module.exports = router;
