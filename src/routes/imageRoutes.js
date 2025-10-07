// src/routes/imageRoutes.js
const express = require("express");
const {
  rotateImage,
  updateImageOrder,
  testRoute,
} = require("../controllers/imageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use((req, res, next) => {
  console.log(
    `[ROUTER DEBUG] A intrat o cerere în imageRoutes. METODA: ${req.method}, URL: ${req.originalUrl}`
  );
  next();
});

router.use(isAuthenticated);

router.get("/test", testRoute);

// --- MODIFICARE CHEIE: Ruta mai specifică este acum PRIMA ---
router.put("/order/:listingId", updateImageOrder);

// Ruta mai generală este acum a DOUA
router.put("/:imageId/rotate", rotateImage);

module.exports = router;
