// src/routes/imageRoutes.js
const express = require("express");
const { rotateImage } = require("../controllers/imageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// --- Middleware "Spion" ---
// Acest cod se va executa pentru FIECARE cerere care ajunge la /api/images
router.use((req, res, next) => {
  console.log(
    `[SPY] A intrat o cerere în imageRoutes. METODA: ${req.method}, URL: ${req.originalUrl}`
  );
  next(); // Trimite cererea mai departe
});
// --- Sfârșit Middleware ---

router.use(isAuthenticated);

// Rută pentru a roti o imagine existentă
router.put("/:imageId/rotate", rotateImage);

module.exports = router;
