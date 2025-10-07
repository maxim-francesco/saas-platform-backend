// src/routes/imageRoutes.js
const express = require("express");
const {
  rotateImage,
  updateImageOrder,
} = require("../controllers/imageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);

// Rută pentru a roti o imagine
router.put("/:imageId/rotate", rotateImage);
router.put("/order/:listingId", updateImageOrder);

module.exports = router;
