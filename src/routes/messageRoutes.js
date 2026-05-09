// src/routes/messageRoutes.js
const express = require("express");
const {
  getMessages,
  toggleMessageRead,
  deleteMessage,
} = require("../controllers/messageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const router = express.Router();

// Protejăm toate rutele din acest fișier cu middleware-ul de autentificare
router.use(isAuthenticated);

// GET /api/messages — listă mesaje
router.get("/", getMessages);

// PATCH /api/messages/:messageId/read — marchează ca citit / necitit (toggle)
router.patch("/:messageId/read", toggleMessageRead);

// DELETE /api/messages/:messageId — șterge mesaj
router.delete("/:messageId", deleteMessage);

module.exports = router;
