// routes/bulk/index.js — mounts all Bulk POS sub-routers under /api/bulk
const express = require("express");
const router = express.Router();

router.use("/customers", require("./customers"));
router.use("/", require("./pricing"));
router.use("/orders", require("./orders"));

module.exports = router;
