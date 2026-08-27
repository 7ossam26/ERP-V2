/**
 * routes/stockWriteOffs.js — إهلاك
 *
 * Mounted at /api/stock-writeoffs, deliberately NOT under /api/inventory:
 * middleware/auditCapture.js skips that prefix, and a route that destroys stock
 * and moves the P&L must stay in the audit trail.
 */

const express = require("express");
const router = express.Router();

const { authenticateToken, requirePermission } = require("../middleware/auth");
const ctrl = require("../controllers/stockWriteOff.controller");

// STOCK_WRITE_OFF is gated separately from INVENTORY_COUNT on purpose: viewing
// the جرد must not imply the ability to destroy stock and change reported profit.
router.use(authenticateToken, requirePermission("STOCK_WRITE_OFF"));

// Literal paths first, and :itemId namespaced under /item/ rather than sitting
// at the root, so no literal route added later can be shadowed by it.
router.get("/reasons", ctrl.reasons);
router.get("/summary", ctrl.summary);
router.get("/item/:itemId", ctrl.itemHistory);
router.get("/", ctrl.listItems);

router.post("/", ctrl.create);
// A reversal is a contra row, never a delete — deleting would rewrite the closed
// month the original landed in. Hence POST /reverse and no DELETE route at all.
router.post("/:id/reverse", ctrl.reverse);

module.exports = router;
