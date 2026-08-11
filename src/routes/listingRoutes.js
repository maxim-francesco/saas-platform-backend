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
  getIncomingListings,
  markAsSold,
  reactivateListing,
  cloneListing,
  uploadVideo,
  deleteVideo
} = require("../controllers/listingController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();
const { uploadImage, uploadVideo: uploadVideoMulter } = require("../middlewares/multer");
const validate = require("../middlewares/validate");
const { createListingSchema, updateListingSchema, markAsSoldSchema } = require("../validations/schemas");


// Protejăm TOATE rutele de anunțuri
router.use(isAuthenticated);

router.post("/", validate(createListingSchema), createListing);
router.get("/", getListings);
router.get("/:listingId", getListingById);
router.put("/:listingId", validate(updateListingSchema), updateListing);
router.delete("/:listingId", deleteListing);
router.post("/:listingId/images", uploadImage.single("image"), uploadImages);
router.delete("/:listingId/images/:imageId", deleteImage);
router.post("/:listingId/reorder-images", updateImageOrder);
router.get("/status/sold", getSoldListings);
router.get("/status/incoming", getIncomingListings);
router.put("/:listingId/sell", validate(markAsSoldSchema), markAsSold);
router.put("/:listingId/reactivate", reactivateListing);
router.post("/:listingId/clone", cloneListing);
router.post('/:listingId/upload-video', uploadVideoMulter.single('video'), uploadVideo);
router.delete('/:listingId/video', deleteVideo);

module.exports = router;