// src/routes/messageRoutes.js
const express = require("express");
const { getMessages } = require("../controllers/messageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele din acest fișier cu middleware-ul de autentificare
router.use(isAuthenticated);

// Definim ruta GET pentru a prelua mesajele
router.get("/", getMessages);

module.exports = router;
