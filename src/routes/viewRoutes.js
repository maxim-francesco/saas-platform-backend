// src/routes/viewRoutes.js
const express = require("express");
const { resetViews, resetViewsForListing } = require("../controllers/viewController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele cu autentificare
router.use(isAuthenticated);

// DELETE /api/views/reset — reset global pentru tot business-ul
router.delete("/reset", resetViews);

// DELETE /api/views/listing/:listingId — reset doar pentru un anunț
router.delete("/listing/:listingId", resetViewsForListing);

module.exports = router;
