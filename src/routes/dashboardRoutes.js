// src/routes/dashboardRoutes.js
const express = require("express");
const { getStats } = require("../controllers/dashboardController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele cu autentificare
router.use(isAuthenticated);

// Definim ruta GET pentru a prelua statisticile
router.get("/stats", getStats);

module.exports = router;
