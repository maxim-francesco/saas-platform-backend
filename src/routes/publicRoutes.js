// src/routes/publicRoutes.js
const express = require("express");
const {
  searchListings,
  getPublicListingById,
  getPublicAttributesForCategory,
} = require("../controllers/publicController");
const router = express.Router();

// Acest endpoint nu folosește middleware-ul `isAuthenticated`
router.get("/listings/search", searchListings);
router.get("/listings/:listingId", getPublicListingById); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get(
  "/categories/:categoryId/attributes",
  getPublicAttributesForCategory
); // ADAUGĂ ACEASTĂ LINIE NOUĂ

module.exports = router;
