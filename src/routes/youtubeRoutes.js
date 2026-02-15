const express = require("express");
const router = express.Router();
const { getUploadUrl } = require("../controllers/youtubeController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Lăsăm doar ruta de care are nevoie Frontend-ul pentru upload
router.post("/get-upload-url", isAuthenticated, getUploadUrl);

module.exports = router;