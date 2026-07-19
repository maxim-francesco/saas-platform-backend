const express = require("express");
const { renderOfferPage, renderOfferByCode } = require("../controllers/offerPublicController");
const { publicBrowseLimiter } = require("../middlewares/rateLimiter");
const router = express.Router();

router.get("/:bizSlug/:offerSlug", publicBrowseLimiter, renderOfferByCode);
router.get("/:token", publicBrowseLimiter, renderOfferPage);

module.exports = router;
