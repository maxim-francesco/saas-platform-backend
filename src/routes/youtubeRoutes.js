const express = require("express");
const router = express.Router();
const { getConnectUrl, handleCallback } = require("../controllers/youtubeController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

router.get("/auth-url", isAuthenticated, getConnectUrl);
router.get("/callback", isAuthenticated, handleCallback);

module.exports = router;