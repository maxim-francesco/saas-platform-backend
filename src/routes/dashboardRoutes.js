// src/routes/dashboardRoutes.js
const express = require("express");
const {
  getStats,
  getListingAnalytics,
  getViewsChart,
  getWeeklySummary,
  getStockCounts
} = require("../controllers/dashboardController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele cu autentificare
router.use(isAuthenticated);

// Definim ruta GET pentru a prelua statisticile
router.get("/stats", getStats);
router.get("/listing-analytics", getListingAnalytics);
router.get("/chart", getViewsChart); // Rută nouă: GET /api/dashboard/chart
router.get("/weekly-summary", getWeeklySummary);
router.get("/stock-counts", getStockCounts);

module.exports = router;
