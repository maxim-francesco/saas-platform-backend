// src/routes/authRoutes.js
const express = require("express");
const { register, login } = require("../controllers/authController");
const { loginLimiter, registerLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

const validate = require("../middlewares/validate");
const { registerSchema, loginSchema } = require("../validations/schemas");

router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);

module.exports = router;
