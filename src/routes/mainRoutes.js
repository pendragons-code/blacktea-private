const express = require("express");
const router = express.Router();

router.use("/", require("./clientRoutes.js"));
// router.use("/api", require("./apiRoutes.js")); - no funcitonal need for this

module.exports = router;