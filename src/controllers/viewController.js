// src/controllers/viewController.js
const prisma = require("../config/prismaClient");

const resetViews = async (req, res) => {
  const { businessId } = req.user; // Preluat din token-ul adminului logat

  try {
    const deleteResult = await prisma.view.deleteMany({
      where: {
        businessId: businessId, // Șterge DOAR vizualizările pentru acest business
      },
    });

    res.status(200).json({
      message: `Resetare completă. Au fost șterse ${deleteResult.count} vizualizări.`,
    });
  } catch (error) {
    res.status(500).json({ message: "Eroare la resetarea vizualizărilor." });
  }
};

module.exports = { resetViews };
