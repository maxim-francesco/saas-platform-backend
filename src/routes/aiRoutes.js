const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { generateDescription } = require("../controllers/aiController");
const router = express.Router();

router.use(isAuthenticated);
router.post("/generate-description", generateDescription);

module.exports = router;
