// src/routes/publicReviewRoutes.js
const express = require("express");
const {
  submitReview,
  getApprovedReviews,
} = require("../controllers/reviewController");
const { publicFormLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

const validate = require("../middlewares/validate");
const { reviewSchema } = require("../validations/schemas");

router.post("/", publicFormLimiter, validate(reviewSchema), submitReview);

// Endpoint pentru a vedea recenziile aprobate
router.get("/", getApprovedReviews);

module.exports = router;
