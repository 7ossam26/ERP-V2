// routes/bulk/orders.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkOrder.controller");

router.use(authenticateToken, requirePermission("BULK_POS"));

router.get("/", ctrl.list);
router.get("/:id", ctrl.detail);
router.post("/", ctrl.create);
router.post("/:id/confirm", ctrl.confirm);
router.post("/:id/cancel", ctrl.cancel);

module.exports = router;
