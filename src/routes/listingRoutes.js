// src/routes/listingRoutes.js
const express = require("express");
const {
  createListing,
  getListings,
  updateListing,
  deleteListing,
} = require("../controllers/listingController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele de anunțuri
router.use(isAuthenticated);

router.post("/", createListing);
router.get("/", getListings);
router.get("/:listingId", getListingById); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.put("/:listingId", updateListing);
router.delete("/:listingId", deleteListing);

module.exports = router;
