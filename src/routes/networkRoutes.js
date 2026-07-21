// src/routes/networkRoutes.js
const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { requireNetworkMember } = require("../middlewares/networkMiddleware");
const validate = require("../middlewares/validate");
const { updateNetworkSettingsSchema } = require("../validations/schemas");
const {
  getNetworkSettings,
  updateNetworkSettings,
  getNetworkDealers,
} = require("../controllers/networkController");

const router = express.Router();

// all network routes require auth
router.use(isAuthenticated);

router.get("/settings", getNetworkSettings); // NOT behind requireNetworkMember
router.patch("/settings", validate(updateNetworkSettingsSchema), updateNetworkSettings);
router.get("/dealers", requireNetworkMember, getNetworkDealers); // membership required

module.exports = router;
