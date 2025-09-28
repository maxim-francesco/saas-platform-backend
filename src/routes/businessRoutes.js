const express = require("express");
const {
  uploadBanner,
  getMyBusiness,
} = require("../controllers/businessController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/multer");
const router = express.Router();

router.use(isAuthenticated);

router.get("/me", getMyBusiness);
router.post("/upload-banner", upload.single("banner"), uploadBanner);

module.exports = router;
