// src/controllers/conversationController.js
const prisma = require("../config/prismaClient");
const { toConversationSummary, toDealerMessage } = require("../utils/networkSerializer");

function canonicalPair(id1, id2) {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

const getOrCreateConversation = async (req, res) => {
  const caller = req.user.businessId;
  const { otherBusinessId, contextType: rawContextType, contextId: rawContextId } = req.body;

  if (otherBusinessId === caller) {
    return res.status(400).json({ message: "Nu poți conversa cu propriul cont." });
  }

  try {
    const otherBusiness = await prisma.business.findUnique({
      where: { id: otherBusinessId },
      select: { id: true, networkEnabled: true }
    });

    if (!otherBusiness || otherBusiness.networkEnabled !== true) {
      return res.status(404).json({ message: "Dealer negăsit în rețea." });
    }

    const contextType = rawContextType || 'GENERAL';
    const contextId = contextType === 'GENERAL' ? null : (rawContextId || null);

    const [a, b] = canonicalPair(caller, otherBusinessId);

    let conv = await prisma.conversation.findFirst({
      where: {
        businessAId: a,
        businessBId: b,
        contextType,
        contextId
      },
      include: {
        businessA: true,
        businessB: true
      }
    });

    if (!conv) {
      try {
        conv = await prisma.conversation.create({
          data: {
            businessAId: a,
            businessBId: b,
            contextType,
            contextId
          },
          include: {
            businessA: true,
            businessB: true
          }
        });
      } catch (err) {
        if (err.code === 'P2002') {
          conv = await prisma.conversation.findFirst({
            where: {
              businessAId: a,
              businessBId: b,
              contextType,
              contextId
            },
            include: {
              businessA: true,
              businessB: true
            }
          });
        } else {
          throw err;
        }
      }
    }

    const unreadCount = await prisma.dealerMessage.count({
      where: {
        conversationId: conv.id,
        senderBusinessId: { not: caller },
        isRead: false
      }
    });

    const lastMessages = await prisma.dealerMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    const lastMessage = lastMessages[0] || null;

    conv._unreadCount = unreadCount;
    conv._lastMessage = lastMessage;

    return res.status(201).json(toConversationSummary(conv, caller));
  } catch (error) {
    console.error("Eroare la getOrCreateConversation:", error);
    return res.status(500).json({ message: "A apărut o eroare la obținerea sau crearea conversației." });
  }
};

const listConversations = async (req, res) => {
  const caller = req.user.businessId;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { businessAId: caller },
          { businessBId: caller }
        ]
      },
      include: {
        businessA: true,
        businessB: true
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    for (const conv of conversations) {
      const unreadCount = await prisma.dealerMessage.count({
        where: {
          conversationId: conv.id,
          senderBusinessId: { not: caller },
          isRead: false
        }
      });

      const lastMessages = await prisma.dealerMessage.findMany({
        where: { conversationId: conv.id },
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      conv._unreadCount = unreadCount;
      conv._lastMessage = lastMessages[0] || null;
    }

    const summaries = conversations.map(conv => toConversationSummary(conv, caller));
    return res.json(summaries);
  } catch (error) {
    console.error("Eroare la listConversations:", error);
    return res.status(500).json({ message: "A apărut o eroare la listarea conversațiilor." });
  }
};

const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const caller = req.user.businessId;

  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conv || (conv.businessAId !== caller && conv.businessBId !== caller)) {
      return res.status(404).json({ message: "Conversație negăsită." });
    }

    const messages = await prisma.dealerMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    const mapped = messages.map(msg => toDealerMessage(msg, caller));

    res.json(mapped);

    await prisma.dealerMessage.updateMany({
      where: {
        conversationId,
        senderBusinessId: { not: caller },
        isRead: false
      },
      data: {
        isRead: true
      }
    });
  } catch (error) {
    console.error("Eroare la getMessages:", error);
    return res.status(500).json({ message: "A apărut o eroare la obținerea mesajelor." });
  }
};

const sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const caller = req.user.businessId;
  const { body } = req.body;

  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conv || (conv.businessAId !== caller && conv.businessBId !== caller)) {
      return res.status(404).json({ message: "Conversație negăsită." });
    }

    const trimmedBody = (body || "").trim();
    if (!trimmedBody) {
      return res.status(400).json({ message: "Mesajul nu poate fi gol." });
    }

    const created = await prisma.dealerMessage.create({
      data: {
        conversationId,
        senderBusinessId: caller,
        body: trimmedBody
      }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });

    return res.status(201).json(toDealerMessage(created, caller));
  } catch (error) {
    console.error("Eroare la sendMessage:", error);
    return res.status(500).json({ message: "A apărut o eroare la trimiterea mesajului." });
  }
};

const unreadCount = async (req, res) => {
  const caller = req.user.businessId;

  try {
    const count = await prisma.dealerMessage.count({
      where: {
        isRead: false,
        senderBusinessId: { not: caller },
        conversation: {
          OR: [
            { businessAId: caller },
            { businessBId: caller }
          ]
        }
      }
    });

    return res.json({ count });
  } catch (error) {
    console.error("Eroare la unreadCount:", error);
    return res.status(500).json({ message: "A apărut o eroare la obținerea numărului de mesaje necitite." });
  }
};

module.exports = {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  unreadCount
};
