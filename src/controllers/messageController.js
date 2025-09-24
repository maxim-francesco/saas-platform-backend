// src/controllers/messageController.js
const prisma = require("../config/prismaClient");

// Funcția pentru a prelua toate mesajele pentru un business
const getMessages = async (req, res) => {
  const { businessId } = req.user; // Preluăm ID-ul din token-ul adminului logat

  try {
    const messages = await prisma.message.findMany({
      where: {
        businessId: businessId,
      },
      orderBy: {
        createdAt: "desc", // Afișăm cele mai noi mesaje primele
      },
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea mesajelor." });
  }
};

module.exports = { getMessages };
