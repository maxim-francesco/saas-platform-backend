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
const validate = require("../middlewares/validate");
const { attributeGroupSchema, assignAttributesSchema } = require("../validations/schemas");


router.use(isAuthenticated);

router.route("/").post(validate(attributeGroupSchema), createGroup).get(getGroups);
router.route("/:groupId").put(validate(attributeGroupSchema), updateGroup).delete(deleteGroup);
router.put("/:groupId/assign-attributes", validate(assignAttributesSchema), assignAttributesToGroup);


module.exports = router;
