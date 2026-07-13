const express = require("express");
const { getMakes, getModelsByMake, getFeatures } = require("../controllers/catalogController");
const { isAuthenticated } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(isAuthenticated);

router.get("/makes", getMakes);
router.get("/makes/:makeId/models", getModelsByMake);
router.get("/features", getFeatures);

module.exports = router;
