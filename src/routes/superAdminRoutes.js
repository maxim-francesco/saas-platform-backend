const express = require("express");
const { getPlatformStats, getAllBusinesses,getBusinessStructure } = require("../controllers/superAdminController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Middleware de verificare: doar SUPER_ADMIN are voiegetBusinessStructure aici
const isSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({ message: "Acces interzis. Necesită rol de Super Admin." });
  }
};

router.use(isAuthenticated, isSuperAdmin);

router.get("/stats", getPlatformStats);
router.get("/businesses", getAllBusinesses);
router.get("/businesses/:businessId/structure", isAuthenticated, isSuperAdmin, );

module.exports = router;