// src/routes/dashboardRoutes.js
const express = require("express");
const {
  getStats,
  getListingAnalytics,
} = require("../controllers/dashboardController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele cu autentificare
router.use(isAuthenticated);

// Definim ruta GET pentru a prelua statisticile
router.get("/stats", getStats);
router.get("/listing-analytics", getListingAnalytics);

module.exports = router;
