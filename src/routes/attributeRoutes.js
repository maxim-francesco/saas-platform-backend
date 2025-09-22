// src/routes/attributeRoutes.js
const express = require("express");
const {
  createAttribute,
  getAttributesForCategory,
} = require("../controllers/attributeController");

// Opțiunea `{ mergeParams: true }` este esențială aici.
// Ea permite acestui router să acceseze parametrii din router-ul părinte (ex: :categoryId).
const router = express.Router({ mergeParams: true });

router.post("/", createAttribute);
router.get("/", getAttributesForCategory);

module.exports = router;
