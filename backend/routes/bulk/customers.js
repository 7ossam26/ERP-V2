// routes/bulk/customers.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requireAnyPermission } = require("../../middleware/auth");
const ctrl = require("../../controllers/bulk/bulkCustomer.controller");

// BULK_POS reps need read access; BULK_CUSTOMERS gates writes.
const READ_PERMS = ["BULK_POS", "BULK_CUSTOMERS"];
const WRITE_PERMS = ["BULK_CUSTOMERS"];

const paymentCtrl = require("../../controllers/bulk/bulkPayment.controller");

router.use(authenticateToken);

router.get("/", requireAnyPermission(READ_PERMS), ctrl.list);
router.get("/:id", requireAnyPermission(READ_PERMS), ctrl.detail);
router.post("/", requireAnyPermission(WRITE_PERMS), ctrl.create);
router.patch("/:id", requireAnyPermission(WRITE_PERMS), ctrl.update);
router.post("/:id/contacts", requireAnyPermission(WRITE_PERMS), ctrl.addContact);
router.delete("/:id/contacts/:contactId", requireAnyPermission(WRITE_PERMS), ctrl.removeContact);
router.get("/:id/payments", requireAnyPermission(READ_PERMS), paymentCtrl.listByCustomer);

module.exports = router;
