// src/controllers/messageController.js
const prisma = require("../config/prismaClient");
const { buildListingPublicUrl } = require("../utils/urlHelper");


// Funcția pentru a prelua toate mesajele pentru un business
const getMessages = async (req, res) => {
  const { businessId } = req.user;

  try {
    const messages = await prisma.message.findMany({
      where: {
        businessId: businessId,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea mesajelor." });
  }
};


// Funcția pentru a marca un mesaj ca citit / necitit (toggle)
const toggleMessageRead = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;
  const { isRead } = req.body;

  try {
    // Verificare de securitate: mesajul trebuie să aparțină business-ului
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    // Dacă isRead nu e furnizat în body, marcăm automat ca citit (comportament default)
    const newReadStatus = typeof isRead === "boolean" ? isRead : true;

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: newReadStatus },
    });

    res.status(200).json(updatedMessage);
  } catch (error) {
    console.error("Eroare la actualizarea mesajului:", error);
    res.status(500).json({ message: "Eroare la actualizarea mesajului." });
  }
};

// Funcția pentru a șterge un mesaj
const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;

  try {
    // Verificare de securitate
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    res.status(200).json({ message: "Mesajul a fost șters cu succes." });
  } catch (error) {
    console.error("Eroare la ștergerea mesajului:", error);
    res.status(500).json({ message: "Eroare la ștergerea mesajului." });
  }
};

// GET /:messageId -> detalii lead
const getMessageDetail = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
      include: {
        listing: {
          include: {
            images: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
        activities: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    if (message.listing) {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, listingUrlPattern: true },
      });
      message.listing.publicUrl = buildListingPublicUrl(business, message.listing);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Eroare la preluarea detaliilor mesajului:", error);
    res.status(500).json({ message: "Eroare la preluarea detaliilor mesajului." });
  }
};

// PATCH /:messageId/status -> actualizare status lead
const updateMessageStatus = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;
  const { status, lostReason } = req.body;

  if (status !== undefined && !["NEW", "CONTACTED", "VIEWING", "OFFER", "WON", "LOST"].includes(status)) {
    return res.status(400).json({ message: "Statusul furnizat este invalid." });
  }

  if (lostReason !== undefined && lostReason !== null && lostReason !== "" && !["PRICE", "BOUGHT_ELSEWHERE", "UNREACHABLE", "NOT_SERIOUS", "OTHER"].includes(lostReason)) {
    return res.status(400).json({ message: "Motivul pierderii este invalid." });
  }

  if (status === "LOST" && !lostReason) {
    return res.status(400).json({ message: "Motivul pierderii este obligatoriu când statusul este LOST." });
  }

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    const oldStatus = message.status;
    const authorId = req.user?.userId || req.user?.id || null;

    const updatedMessage = await prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: messageId },
        data: {
          status: status,
          lostReason: status === "LOST" ? lostReason : null,
        },
      });

      if (oldStatus !== status) {
        await tx.messageActivity.create({
          data: {
            messageId: messageId,
            kind: "STATUS_CHANGED",
            fromValue: oldStatus,
            toValue: status,
            authorId: authorId,
          },
        });
      }

      return updated;
    });

    res.status(200).json(updatedMessage);
  } catch (error) {
    console.error("Eroare la actualizarea statusului mesajului:", error);
    res.status(500).json({ message: "Eroare la actualizarea statusului mesajului." });
  }
};

// PATCH /:messageId -> actualizare tip sau listing asociat
const updateMessage = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;
  const { type, listingId } = req.body;

  if (type !== undefined && !["GENERAL", "STOCK", "ORDER", "BUYBACK"].includes(type)) {
    return res.status(400).json({ message: "Tipul de mesaj furnizat este invalid. Valori permise: GENERAL, STOCK, ORDER, BUYBACK." });
  }

  const normalizedListingId = listingId === "" ? null : listingId;

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    if (normalizedListingId) {
      const listing = await prisma.listing.findFirst({
        where: { id: normalizedListingId, businessId: businessId },
      });
      if (!listing) {
        return res.status(400).json({ message: "Anunțul specificat nu aparține acestui business sau nu există." });
      }
    }

    const oldType = message.type;
    const oldListingId = message.listingId;
    const authorId = req.user?.userId || req.user?.id || null;

    const dataToUpdate = {};
    if (type !== undefined) dataToUpdate.type = type;
    if (listingId !== undefined) dataToUpdate.listingId = normalizedListingId;

    const updatedMessage = await prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: messageId },
        data: dataToUpdate,
      });

      if (type !== undefined && oldType !== type) {
        await tx.messageActivity.create({
          data: {
            messageId: messageId,
            kind: "TYPE_CHANGED",
            fromValue: oldType,
            toValue: type,
            authorId: authorId,
          },
        });
      }

      if (listingId !== undefined && oldListingId !== normalizedListingId) {
        await tx.messageActivity.create({
          data: {
            messageId: messageId,
            kind: "LINKED_LISTING",
            fromValue: oldListingId || null,
            toValue: normalizedListingId || null,
            authorId: authorId,
          },
        });
      }

      return updated;
    });

    res.status(200).json(updatedMessage);
  } catch (error) {
    console.error("Eroare la actualizarea mesajului:", error);
    res.status(500).json({ message: "Eroare la actualizarea mesajului." });
  }
};

// POST /:messageId/notes -> adăugare notă (activitate tip NOTE)
const createMessageNote = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;
  const { body } = req.body;

  if (!body) {
    return res.status(400).json({ message: "Conținutul notei este obligatoriu." });
  }

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    const authorId = req.user?.userId || req.user?.id || null;

    const activity = await prisma.messageActivity.create({
      data: {
        messageId: messageId,
        kind: "NOTE",
        body: body,
        authorId: authorId,
      },
    });

    res.status(201).json(activity);
  } catch (error) {
    console.error("Eroare la adăugarea notei:", error);
    res.status(500).json({ message: "Eroare la adăugarea notei." });
  }
};

// PATCH /:messageId/reminder -> setare/ștergere reminder
const updateMessageReminder = async (req, res) => {
  const { messageId } = req.params;
  const { businessId } = req.user;
  const { reminderAt } = req.body;

  try {
    const message = await prisma.message.findFirst({
      where: { id: messageId, businessId: businessId },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mesajul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    const authorId = req.user?.userId || req.user?.id || null;
    const parsedReminderAt = reminderAt ? new Date(reminderAt) : null;

    const updatedMessage = await prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: messageId },
        data: {
          reminderAt: parsedReminderAt,
        },
      });

      if (parsedReminderAt) {
        await tx.messageActivity.create({
          data: {
            messageId: messageId,
            kind: "REMINDER_SET",
            toValue: parsedReminderAt.toISOString(),
            authorId: authorId,
          },
        });
      } else {
        await tx.messageActivity.create({
          data: {
            messageId: messageId,
            kind: "REMINDER_CLEARED",
            authorId: authorId,
          },
        });
      }

      return updated;
    });

    res.status(200).json(updatedMessage);
  } catch (error) {
    console.error("Eroare la actualizarea reminderului:", error);
    res.status(500).json({ message: "Eroare la actualizarea reminderului." });
  }
};

// GET /counts -> statistici (leads)
const getMessageCounts = async (req, res) => {
  const { businessId } = req.user;

  try {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const actionNeededCount = await prisma.message.count({
      where: {
        businessId: businessId,
        OR: [
          { status: "NEW" },
          {
            reminderAt: { lte: endOfToday },
            status: {
              notIn: ["WON", "LOST"],
            },
          },
        ],
      },
    });

    const unreadCount = await prisma.message.count({
      where: {
        businessId: businessId,
        isRead: false,
      },
    });

    const statusGroups = await prisma.message.groupBy({
      by: ["status"],
      where: { businessId: businessId },
      _count: { _all: true },
    });

    const typeGroups = await prisma.message.groupBy({
      by: ["type"],
      where: { businessId: businessId },
      _count: { _all: true },
    });

    const byStatus = {};
    statusGroups.forEach((g) => {
      byStatus[g.status] = g._count._all;
    });

    const byType = {};
    typeGroups.forEach((g) => {
      byType[g.type] = g._count._all;
    });

    res.status(200).json({
      actionNeeded: actionNeededCount,
      unread: unreadCount,
      byStatus,
      byType,
    });
  } catch (error) {
    console.error("Eroare la calcularea statisticilor mesajelor:", error);
    res.status(500).json({ message: "Eroare la calcularea statisticilor." });
  }
};

// POST / -> creare manuală lead
const createMessage = async (req, res) => {
  const { businessId } = req.user;
  const { name, phone, email, message, type, listingId } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Numărul de telefon este obligatoriu." });
  }

  try {
    if (listingId) {
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, businessId: businessId },
      });
      if (!listing) {
        return res.status(400).json({
          message: "Autovehiculul selectat nu există sau nu aparține afacerii dumneavoastră.",
        });
      }
    }

    const authorId = req.user?.userId || req.user?.id || null;

    const newMessage = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          businessId,
          name: name?.trim() || "Lead telefonic",
          phone: phone.trim(),
          email: email?.trim() || "",
          message: message?.trim() || "",
          type: type || "GENERAL",
          status: "NEW",
          listingId: listingId || null,
          isRead: true,
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      await tx.messageActivity.create({
        data: {
          messageId: msg.id,
          kind: "CREATED",
          authorId: authorId,
        },
      });

      return msg;
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Eroare la crearea manuală a lead-ului:", error);
    res.status(500).json({ message: "Eroare la crearea manuală a lead-ului." });
  }
};

module.exports = {
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
};

