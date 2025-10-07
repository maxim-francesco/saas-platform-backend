const express = require("express");
const { rotateImage } = require("../controllers/imageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);

// Rută pentru a roti o imagine
router.put("/:imageId/rotate", rotateImage);

module.exports = router;
