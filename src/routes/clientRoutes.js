const express = require("express");
const { validateTokenMiddleWare } = require("../controller/authorization.js");
const clientRoutes = require("../controller/user.js");
const router = express.Router();

// post methods for auth
router.post("/signup", clientRoutes.userSignup);
router.post("/login", clientRoutes.userLogin);

// get methods
router.get("/", validateTokenMiddleWare, clientRoutes.renderHomePage);
router.get("/landing", clientRoutes.renderLandingPage);

module.exports = router;