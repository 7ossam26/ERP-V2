const express = require("express");
const router = express.Router();
const deliveryZoneController = require("../controllers/deliveryZone.controller");
const { authenticateToken, requireAnyPermission, requireCreatePermission } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// GET all delivery zones — readable by anyone with POS or delivery access
router.get("/", requireAnyPermission(["POS", "CREATES_DELIVERY_ZONES", "DELIVERY_SETTLEMENT"]), deliveryZoneController.getAllDeliveryZones);

// GET single delivery zone by ID
router.get("/:id", requireAnyPermission(["POS", "CREATES_DELIVERY_ZONES"]), deliveryZoneController.getDeliveryZoneById);

// POST create new delivery zone
router.post("/", requireCreatePermission("CREATES_DELIVERY_ZONES"), deliveryZoneController.createDeliveryZone);

// PUT update delivery zone
router.put("/:id", requireCreatePermission("CREATES_DELIVERY_ZONES"), deliveryZoneController.updateDeliveryZone);

// DELETE delivery zone (soft delete)
router.delete("/:id", requireCreatePermission("CREATES_DELIVERY_ZONES"), deliveryZoneController.deleteDeliveryZone);

module.exports = router;
