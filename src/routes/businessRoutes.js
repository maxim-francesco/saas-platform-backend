// Modifică fișierul src/routes/businessRoutes.js

const express = require("express");
const {
  uploadBanner,
  getMyBusiness,
  deleteBanner, 
  updateBusinessSettings,
  updateBusinessProfile,
  updateBusinessIdentity
} = require("../controllers/businessController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { uploadImage } = require("../middlewares/multer");
const router = express.Router();
const validate = require("../middlewares/validate");
const { updateProfileSchema, updateSettingsSchema, updateIdentitySchema } = require("../validations/schemas");


router.use(isAuthenticated);

router.get("/me", getMyBusiness);
router.post("/upload-banner", uploadImage.single("banner"), uploadBanner);
router.delete("/banner", deleteBanner); 
router.put("/profile", validate(updateProfileSchema), updateBusinessProfile);
router.put("/settings", validate(updateSettingsSchema), updateBusinessSettings);
router.put("/identity", validate(updateIdentitySchema), updateBusinessIdentity);

module.exports = router;
