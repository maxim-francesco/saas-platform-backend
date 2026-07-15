// src/routes/messageRoutes.js
const express = require("express");
const {
  getMessages,
  toggleMessageRead,
  deleteMessage,
  getMessageDetail,
  updateMessageStatus,
  updateMessage,
  createMessageNote,
  updateMessageReminder,
  getMessageCounts,
  createMessage,
} = require("../controllers/messageController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const { createManualLeadSchema } = require("../validations/schemas");

const router = express.Router();

// Protejăm toate rutele din acest fișier cu middleware-ul de autentificare
router.use(isAuthenticated);

// POST /api/messages — adăugare manuală lead
router.post("/", validate(createManualLeadSchema), createMessage);

// GET /api/messages — listă mesaje
router.get("/", getMessages);


// GET /api/messages/counts — statistici mesaje (leads)
router.get("/counts", getMessageCounts);

// GET /api/messages/:messageId — detalii mesaj cu listing și activități
router.get("/:messageId", getMessageDetail);

// PATCH /api/messages/:messageId/read — marchează ca citit / necitit (toggle)
router.patch("/:messageId/read", toggleMessageRead);

// PATCH /api/messages/:messageId/status — actualizare status lead
router.patch("/:messageId/status", updateMessageStatus);

// PATCH /api/messages/:messageId — actualizare tip sau asociere anunț
router.patch("/:messageId", updateMessage);

// POST /api/messages/:messageId/notes — adăugare notă (activitate tip NOTE)
router.post("/:messageId/notes", createMessageNote);

// PATCH /api/messages/:messageId/reminder — setare/ștergere reminder
router.patch("/:messageId/reminder", updateMessageReminder);

// DELETE /api/messages/:messageId — șterge mesaj
router.delete("/:messageId", deleteMessage);

module.exports = router;
