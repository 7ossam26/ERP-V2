// routes/bulk/reports.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkReport.controller");

router.use(authenticateToken, requirePermission("BULK_POS"));

router.get("/sales-by-customer", ctrl.salesByCustomer);
router.get("/ar-aging", ctrl.arAging);
router.get("/statement", ctrl.statement);

module.exports = router;
