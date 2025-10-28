// src/routes/listingRoutes.js
const express = require("express");
const {
  createListing,
  getListings,
  updateListing,
  deleteListing,
  getListingById,
  uploadImages,
  updateImageOrder,
  deleteImage,
  getSoldListings,
  markAsSold,
  reactivateListing,
} = require("../controllers/listingController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const upload = require("../middlewares/multer");

// Protejăm toate rutele de anunțuri
router.use(isAuthenticated);

router.post("/", createListing);
router.get("/", getListings);
router.get("/:listingId", getListingById);
router.put("/:listingId", updateListing); // <-- VERIFICĂ ACEASTĂ LINIE ÎN MOD SPECIAL
router.delete("/:listingId", deleteListing);
router.post("/:listingId/images", upload.single("image"), uploadImages);
router.delete("/:listingId/images/:imageId", deleteImage); // <-- ADAUGĂ ACEASTĂ LINIE NOUĂ
router.post("/:listingId/reorder-images", updateImageOrder);
router.get("/status/sold", getSoldListings); // Rută pentru anunturi vândute
router.put("/:listingId/sell", markAsSold); // Rută pentru a marca un anunt ca vândut
router.put("/:listingId/reactivate", reactivateListing);

module.exports = router;
