// src/routes/publicRoutes.js
const express = require("express");
const {
  searchListings,
  getPublicListingById,
  getPublicAttributesForCategory,
  getUniqueAttributeValues,
  getAttributeStats,
  submitContactForm,
} = require("../controllers/publicController");
const { getSoldListings } = require("../controllers/listingController");
const { publicFormLimiter, publicBrowseLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

const validate = require("../middlewares/validate");
const { contactFormSchema } = require("../validations/schemas");

// Acest endpoint nu folosește middleware-ul `isAuthenticated`
router.get("/listings/search", publicBrowseLimiter, searchListings);
router.get("/listings/:listingId", getPublicListingById); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get(
  "/categories/:categoryId/attributes",
  getPublicAttributesForCategory
); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get("/attributes/:attributeId/unique-values", getUniqueAttributeValues); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get("/attributes/:attributeId/stats", getAttributeStats); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.post("/contact", publicFormLimiter, validate(contactFormSchema), submitContactForm);
router.get("/listings/status/sold", getSoldListings);

module.exports = router;
