// routes/bulk/index.js — mounts all Bulk POS sub-routers under /api/bulk
const express = require("express");
const router = express.Router();

router.use("/customers", require("./customers"));
router.use("/items", require("./items"));
// Mounted at "/" — keep it below the specific paths above so it can't shadow them.
router.use("/", require("./pricing"));
router.use("/orders", require("./orders"));
router.use("/payments", require("./payments"));
router.use("/reports", require("./reports"));

module.exports = router;
