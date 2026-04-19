// routes/callCenter.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requirePermission } = require("../middleware/auth");
const ctrl = require("../controllers/callCenter.controller");

router.use(authenticateToken, requirePermission("CALL_CENTER"));

router.get("/branches", ctrl.listBranches);
router.get("/items", ctrl.listItems);

router.get("/clients", ctrl.searchClients);
router.post("/clients", ctrl.createClient);

router.post("/orders", ctrl.createOrder);
router.get("/orders", ctrl.listOrders);
router.post("/orders/:id/cancel", ctrl.cancelOrder);

module.exports = router;
