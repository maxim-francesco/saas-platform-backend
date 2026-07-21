// src/routes/tradeRoutes.js
const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { requireNetworkMember } = require("../middlewares/networkMiddleware");
const validate = require("../middlewares/validate");
const { exposeTradeSchema, updateTradeSchema } = require("../validations/schemas");
const {
  getSlowStock,
  getMyTradeListings,
  exposeListing,
  browseTradeListings,
  getTradeListing,
  updateTradeListing,
  unexposeListing,
} = require("../controllers/tradeController");

const router = express.Router();

router.use(isAuthenticated);
router.use(requireNetworkMember);

router.get("/slow-stock", getSlowStock);
router.get("/mine", getMyTradeListings);
router.post("/expose", validate(exposeTradeSchema), exposeListing);
router.get("/", browseTradeListings);
router.get("/:id", getTradeListing);
router.patch("/:id", validate(updateTradeSchema), updateTradeListing);
router.delete("/:id", unexposeListing);

module.exports = router;
