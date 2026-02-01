const express = require("express");
const router = express.Router();
const deliveryController = require("../controllers/delivery.controller");
const {
  authenticateToken,
  requireCreatePermission,
} = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

router.post(
  "/",
  requireCreatePermission("CREATES_DELIVERY_MEN"),
  deliveryController.createDeliveryMan,
);

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

module.exports = router;
