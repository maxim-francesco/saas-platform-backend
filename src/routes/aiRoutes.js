const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { generateDescription, generateArticle, suggestTopics, diagnoseListing, generateMarketing } = require("../controllers/aiController");
const router = express.Router();

router.use(isAuthenticated);
router.post("/generate-description", generateDescription);
router.post("/generate-article", generateArticle);
router.post("/suggest-topics", suggestTopics);
router.get("/diagnose-listing/:listingId", diagnoseListing);
router.post("/generate-marketing", generateMarketing);

module.exports = router;
