// src/routes/listingRoutes.js
const express = require("express");
const {
  createListing,
  getListings,
  updateListing,
  deleteListing,
  getListingById,
  uploadImages,
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

module.exports = router;
