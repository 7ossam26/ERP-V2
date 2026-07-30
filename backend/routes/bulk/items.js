// routes/bulk/items.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkItem.controller");

// BULK_POS alone is enough — see the controller for why this doesn't reuse
// /api/inventory, whose permission set a wholesale-only role may not have.
router.use(authenticateToken, requirePermission("BULK_POS"));

router.get("/", ctrl.listItems);

module.exports = router;
