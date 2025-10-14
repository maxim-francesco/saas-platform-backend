// Modifică fișierul src/routes/businessRoutes.js

const express = require("express");
const {
  uploadBanner,
  getMyBusiness,
  deleteBanner, // 1. Importă noua funcție
} = require("../controllers/businessController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/multer");
const router = express.Router();

router.use(isAuthenticated);

router.get("/me", getMyBusiness);
router.post("/upload-banner", upload.single("banner"), uploadBanner);
router.delete("/banner", deleteBanner); // 2. Adaugă această nouă rută

module.exports = router;
