// src/routes/imageRoutes.js
const express = require("express");
const {
  rotateImage,
  updateImageOrder,
  testRoute,
} = require("../controllers/imageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);

// --- RUTA NOUĂ DE TEST ---
router.get("/test", testRoute);

// Rută pentru a roti o imagine
router.put("/:imageId/rotate", rotateImage);

// Rută pentru a actualiza ordinea
router.put("/order/:listingId", updateImageOrder);

module.exports = router;
