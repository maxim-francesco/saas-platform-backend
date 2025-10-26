// src/routes/publicReviewRoutes.js
const express = require("express");
const {
  submitReview,
  getApprovedReviews,
} = require("../controllers/reviewController");
const router = express.Router();

// Endpoint pentru a trimite o recenzie nouă
router.post("/", submitReview);

// Endpoint pentru a vedea recenziile aprobate
router.get("/", getApprovedReviews);

module.exports = router;
