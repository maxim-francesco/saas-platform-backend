const express = require("express");
const {
  getUngroupedAttributes,
} = require("../controllers/attributeController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);
router.get("/ungrouped", getUngroupedAttributes);

module.exports = router;
