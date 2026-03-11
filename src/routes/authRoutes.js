// src/routes/authRoutes.js
const express = require("express");
const { register, login } = require("../controllers/authController");
const { loginLimiter, registerLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

module.exports = router;
