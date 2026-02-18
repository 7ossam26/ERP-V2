const express = require("express");
const router = express.Router();
const deliveryController = require("../controllers/delivery.controller");
const {
  authenticateToken,
  requireCreatePermission,
  requireAnyPermission,
} = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

router.post(
  "/",
  requireCreatePermission("CREATES_DELIVERY_MEN"),
  deliveryController.createDeliveryMan,
);

router.post(
  "/settle",
  deliveryController.settleDeliveryMan,
);

router.post(
  "/verify-manager",
  deliveryController.verifyManagerCredentials,
);

router.get("/stats", deliveryController.getDeliveryStats);

router.get(
  "/",
  // requirePermission('POS'), // Or relevant permission to view delivery men
  deliveryController.getAllDeliveryMen,
);

router.put(
  "/:id",
  requireCreatePermission("CREATES_DELIVERY_MEN"),
  deliveryController.updateDeliveryMan,
);

router.delete(
  "/:id",
  requireCreatePermission("CREATES_DELIVERY_MEN"),
  deliveryController.deleteDeliveryMan,
);

// Get daily settlement report
router.get(
  "/daily-report",
  requireAnyPermission(["DELIVERY_SETTLEMENT", "POS", "CREATES_DELIVERY_MEN"]),
  deliveryController.getDailyReport,
);

// Get delivery man history
router.get(
  "/:id/history",
  requireAnyPermission(["POS", "CREATES_DELIVERY_MEN"]),
  deliveryController.getDeliveryHistory,
);

module.exports = router;
