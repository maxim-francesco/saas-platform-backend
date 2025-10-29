// src/routes/viewRoutes.js
const express = require("express");
const { resetViews } = require("../controllers/viewController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm ruta cu autentificare
router.use(isAuthenticated);

// Definim ruta: DELETE /api/views/reset
router.delete("/reset", resetViews);

module.exports = router;
