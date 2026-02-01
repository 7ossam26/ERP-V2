const express = require("express");
const router = express.Router();
const deliveryZoneController = require("../controllers/deliveryZone.controller");
const { authenticateToken } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// GET all delivery zones
router.get("/", deliveryZoneController.getAllDeliveryZones);

// GET single delivery zone by ID
router.get("/:id", deliveryZoneController.getDeliveryZoneById);

// POST create new delivery zone
router.post("/", deliveryZoneController.createDeliveryZone);

// PUT update delivery zone
router.put("/:id", deliveryZoneController.updateDeliveryZone);

// DELETE delivery zone (soft delete)
router.delete("/:id", deliveryZoneController.deleteDeliveryZone);

module.exports = router;
