// src/routes/reportsRoutes.js
const express = require("express");
const { getProfitabilityReport } = require("../controllers/reportsController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele de rapoarte
router.use(isAuthenticated);

router.get("/profitability", getProfitabilityReport);

module.exports = router;
