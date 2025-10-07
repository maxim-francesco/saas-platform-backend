// src/routes/imageRoutes.js
const express = require("express");
const {
  rotateImage,
  updateImageOrder,
  testRoute,
} = require("../controllers/imageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// --- Middleware "Spion" ---
// Acest cod se va executa pentru FIECARE cerere care ajunge la /api/images
router.use((req, res, next) => {
  console.log(
    `[ROUTER DEBUG] A intrat o cerere în imageRoutes. METODA: ${req.method}, URL: ${req.originalUrl}`
  );
  next(); // Trimite cererea mai departe la următoarea rută potrivită
});
// --- Sfârșit Middleware ---

router.use(isAuthenticated);

router.get("/test", testRoute);
router.put("/:imageId/rotate", rotateImage);
router.put("/order/:listingId", updateImageOrder);

module.exports = router;
