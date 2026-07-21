// src/routes/conversationRoutes.js
const express = require("express");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const { requireNetworkMember } = require("../middlewares/networkMiddleware");
const validate = require("../middlewares/validate");
const {
  getOrCreateConversationSchema,
  sendMessageSchema,
} = require("../validations/schemas");
const {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  unreadCount,
} = require("../controllers/conversationController");

const router = express.Router();

router.use(isAuthenticated);
router.use(requireNetworkMember);

router.post("/", validate(getOrCreateConversationSchema), getOrCreateConversation);
router.get("/", listConversations);
router.get("/unread/count", unreadCount); // BEFORE /:conversationId routes
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", validate(sendMessageSchema), sendMessage);

module.exports = router;
