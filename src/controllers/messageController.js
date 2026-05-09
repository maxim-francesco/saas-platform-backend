// src/controllers/messageController.js
const prisma = require("../config/prismaClient");

// Funcția pentru a prelua toate mesajele pentru un business
const getMessages = async (req, res) => {
  const { businessId } = req.user;

  try {
    const messages = await prisma.message.findMany({
      where: {
        businessId: businessId,
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

module.exports = { getMessages, toggleMessageRead, deleteMessage };
