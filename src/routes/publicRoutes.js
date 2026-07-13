// src/routes/publicRoutes.js
const express = require("express");
const {
  searchListings,
  getPublicListingById,
  getPublicAttributesForCategory,
  getUniqueAttributeValues,
  getAttributeStats,
  submitContactForm,
  getListingsCsvFeed,
} = require("../controllers/publicController");
const { getSoldListings } = require("../controllers/listingController");
const { publicFormLimiter, publicBrowseLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

const validate = require("../middlewares/validate");
const { contactFormSchema } = require("../validations/schemas");

// Acest endpoint nu folosește middleware-ul `isAuthenticated`
router.get("/listings/csv-feed", publicBrowseLimiter, getListingsCsvFeed);
router.get("/listings/search", publicBrowseLimiter, searchListings);
router.get("/listings/:listingId", getPublicListingById); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get(
  "/categories/:categoryId/attributes",
  getPublicAttributesForCategory
); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get("/attributes/:attributeId/unique-values", getUniqueAttributeValues); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.get("/attributes/:attributeId/stats", getAttributeStats); // ADAUGĂ ACEASTĂ LINIE NOUĂ
router.post("/contact", publicFormLimiter, validate(contactFormSchema), submitContactForm);
router.get("/listings/status/sold", (req, res, next) => {
  if (!req.query.businessId) {
    return res.status(400).json({ message: "businessId este obligatoriu." });
  }
  next();
}, async (req, res) => {
  const prisma = require("../config/prismaClient");
  const { toLegacyListing } = require("../utils/compatSerializer");
  const listings = await prisma.listing.findMany({
    where: { businessId: req.query.businessId, status: "SOLD" },
    include: {
      make: true,
      model: true,
      features: true,
      images: { orderBy: { order: "asc" } },
    },
    orderBy: { soldAt: "desc" },
    take: req.query.limit ? parseInt(req.query.limit) : 20,
  });
  
  res.status(200).json(listings.map(l => {
    const legacy = toLegacyListing(l, { mode: 'search' });
    return {
      id: legacy.id,
      title: legacy.title,
      price: legacy.price,
      soldAt: legacy.soldAt,
      status: legacy.status,
      images: legacy.images.slice(0, 1),
      category: legacy.category
    };
  }));
});

module.exports = router;
