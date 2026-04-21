// routes/bulk/pricing.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requireAnyPermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkContractPrice.controller");

const READ_PERMS = ["BULK_POS", "BULK_PRICING", "BULK_CUSTOMERS"];
const WRITE_PERMS = ["BULK_PRICING"];

router.use(authenticateToken);

router.get("/customers/:id/prices", requireAnyPermission(READ_PERMS), ctrl.list);
router.put("/customers/:id/prices", requireAnyPermission(WRITE_PERMS), ctrl.bulkReplace);
router.patch("/customers/:id/prices", requireAnyPermission(WRITE_PERMS), ctrl.bulkMerge);
router.delete("/customers/:id/prices/:priceId", requireAnyPermission(WRITE_PERMS), ctrl.remove);

module.exports = router;
