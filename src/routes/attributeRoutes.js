// src/routes/attributeRoutes.js
const express = require("express");
const {
  createAttribute,
  getAttributesForCategory,
  updateAttribute, // Importă funcția nouă
  deleteAttribute, // Importă funcția nouă
} = require("../controllers/attributeController");

const router = express.Router({ mergeParams: true });

router.post("/", createAttribute);
router.get("/", getAttributesForCategory);
router.put("/:attributeId", updateAttribute); // Rută nouă
router.delete("/:attributeId", deleteAttribute); // Rută nouă

module.exports = router;
