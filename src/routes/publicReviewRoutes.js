// src/routes/publicReviewRoutes.js
const express = require("express");
const {
  submitReview,
  getApprovedReviews,
} = require("../controllers/reviewController");
const { publicFormLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

// Endpoint pentru a trimite o recenzie nouă
router.post("/", publicFormLimiter, submitReview);

// Endpoint pentru a vedea recenziile aprobate
router.get("/", getApprovedReviews);

module.exports = router;
