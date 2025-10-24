// src/routes/attributeGroupRoutes.js
const express = require("express");
const {
  createGroup,
  getGroups,
  updateGroup,
  deleteGroup,
  assignAttributesToGroup,
} = require("../controllers/attributeGroupController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(isAuthenticated);

router.route("/").post(createGroup).get(getGroups);
router.route("/:groupId").put(updateGroup).delete(deleteGroup);
router.put("/:groupId/assign-attributes", assignAttributesToGroup);

module.exports = router;
