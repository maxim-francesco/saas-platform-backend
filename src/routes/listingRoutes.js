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
  cloneListing,
  uploadVideo,
  deleteVideo
} = require("../controllers/listingController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const upload = require("../middlewares/multer");

// Protejăm TOATE rutele de anunțuri
router.use(isAuthenticated);

router.post("/", createListing);
router.get("/", getListings);
router.get("/:listingId", getListingById);
router.put("/:listingId", updateListing);
router.delete("/:listingId", deleteListing);
router.post("/:listingId/images", upload.single("image"), uploadImages);
router.delete("/:listingId/images/:imageId", deleteImage);
router.post("/:listingId/reorder-images", updateImageOrder);
router.get("/status/sold", getSoldListings);
router.put("/:listingId/sell", markAsSold);
router.put("/:listingId/reactivate", reactivateListing);
router.post("/:listingId/clone", cloneListing);
router.post('/:listingId/upload-video', upload.single('video'), uploadVideo);
router.delete('/:listingId/video', deleteVideo);

module.exports = router;