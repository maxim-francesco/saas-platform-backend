// src/routes/publicRoutes.js
const express = require("express");
const { searchListings } = require("../controllers/publicController");
const router = express.Router();

// Acest endpoint nu folosește middleware-ul `isAuthenticated`
router.get("/listings/search", searchListings);

module.exports = router;
