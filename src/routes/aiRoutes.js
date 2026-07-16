const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { generateDescription, generateArticle, suggestTopics } = require("../controllers/aiController");
const router = express.Router();

router.use(isAuthenticated);
router.post("/generate-description", generateDescription);
router.post("/generate-article", generateArticle);
router.post("/suggest-topics", suggestTopics);

module.exports = router;
