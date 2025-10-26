// src/routes/reviewRoutes.js
const express = require("express");
const {
  getReviewsForAdmin,
  approveReview,
  deleteReview,
} = require("../controllers/reviewController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm TOATE rutele de mai jos cu autentificare
router.use(isAuthenticated);

// Rută pentru admin ca să vadă toate recenziile
router.get("/", getReviewsForAdmin);

// Rută pentru a aproba o recenzie
router.put("/:reviewId/approve", approveReview);

// Rută pentru a șterge o recenzie
router.delete("/:reviewId", deleteReview);

module.exports = router;
