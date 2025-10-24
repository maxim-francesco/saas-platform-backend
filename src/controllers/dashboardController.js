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
        // --- ✅ INTEROGĂRI NOI ADĂUGATE ---
        prisma.view.count({ where: { businessId } }), // Număr total de vizualizări
        prisma.view.count({
          where: { businessId, viewedAt: { gte: date30DaysAgo } },
        }), // Vizualizări în ultimele 30 de zile
      ]);

    res.status(200).json({
      totalListings: listingCount,
      totalCategories: categoryCount,
      totalMessages: totalMessageCount,
      unreadMessages: unreadMessageCount,
      totalViews: totalViews, // <-- Adaugă câmpul nou
      viewsLast30Days: viewsLast30Days, // <-- Adaugă câmpul nou
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    res.status(500).json({ message: "Eroare la preluarea statisticilor." });
  }
};

module.exports = { getStats };
