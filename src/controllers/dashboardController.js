// src/controllers/dashboardController.js
const prisma = require("../config/prismaClient");

const getStats = async (req, res) => {
  const { businessId } = req.user;

  try {
    // Folosim $transaction pentru a rula toate interogările în paralel pentru eficiență
    const [listingCount, categoryCount, totalMessageCount, unreadMessageCount] =
      await prisma.$transaction([
        prisma.listing.count({ where: { businessId } }),
        prisma.category.count({ where: { businessId } }),
        prisma.message.count({ where: { businessId } }),
        prisma.message.count({ where: { businessId, isRead: false } }), // Bonus: numărăm și mesajele necitite
      ]);

    res.status(200).json({
      totalListings: listingCount,
      totalCategories: categoryCount,
      totalMessages: totalMessageCount,
      unreadMessages: unreadMessageCount,
      // Momentan, datele pentru grafic și vizualizări sunt statice
      listingViews: 8910,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    res.status(500).json({ message: "Eroare la preluarea statisticilor." });
  }
};

module.exports = { getStats };
