const express = require("express");
const userController = require("../controllers/users.controller");
const { verifyToken } = require("../middlewares/auth");
const router = express.Router();
router.get("/profile", verifyToken, userController.getProfile);
module.exports = router;
