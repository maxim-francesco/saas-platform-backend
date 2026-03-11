// src/routes/categoryRoutes.js
const express = require("express");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const { isAuthenticated } = require("../middlewares/authMiddleware");
const attributeRoutes = require("./attributeRoutes"); // 1. Importă rutele de atribute
const router = express.Router();
const validate = require("../middlewares/validate");
const { categorySchema } = require("../validations/schemas");

router.use(isAuthenticated);

// Rutele existente pentru categorii
router.post("/", validate(categorySchema), createCategory);
router.get("/", getCategories);
router.put("/:categoryId", validate(categorySchema), updateCategory);
router.delete("/:categoryId", deleteCategory); // Rută nouă

// 2. Montează rutele de atribute pe o cale specifică
// Când URL-ul este /:categoryId/attributes, Express va folosi router-ul din attributeRoutes.
router.use("/:categoryId/attributes", attributeRoutes);

module.exports = router;
