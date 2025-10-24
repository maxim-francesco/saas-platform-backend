// src/routes/attributeGroupRoutes.js
const express = require("express");
const {
  createGroup,
  getGroups,
  updateGroup,
  deleteGroup,
} = require("../controllers/attributeGroupController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);

router.route("/").post(createGroup).get(getGroups);
router.route("/:groupId").put(updateGroup).delete(deleteGroup);

module.exports = router;
