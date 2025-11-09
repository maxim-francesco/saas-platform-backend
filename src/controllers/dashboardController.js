// src/controllers/dashboardController.js
const prisma = require("../config/prismaClient");

const getStats = async (req, res) => {
  const { businessId } = req.user;

  // --- ✅ PAS DE DEPANARE #1 ---
  // Verificăm dacă primim corect ID-ul de business din token.
  console.log(
    `[DEBUG] Se preiau statisticile pentru businessId: ${businessId}`
  );
  if (!businessId) {
    console.error(
      "[DEBUG] EROARE CRITICĂ: businessId este undefined în req.user!"
    );
    // Oprim execuția dacă ID-ul lipsește, pentru a nu avea rezultate false.
    return res
      .status(400)
      .json({ message: "ID-ul de business lipsește din token." });
  }
  // --- SFÂRȘIT PAS DE DEPANARE ---

  try {
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

    const [
      listingCount,
      categoryCount,
      totalMessageCount,
      totalViews,
      viewsLast30Days,
    ] = await prisma.$transaction([
      prisma.listing.count({ where: { businessId } }),
      prisma.category.count({ where: { businessId } }),
      prisma.message.count({ where: { businessId } }),
      prisma.view.count({ where: { businessId } }),
      prisma.view.count({
        where: { businessId, viewedAt: { gte: date30DaysAgo } },
      }),
    ]);

    // --- ✅ PAS DE DEPANARE #2 ---
    // Verificăm ce rezultate primim direct din baza de date.
    console.log(
      `[DEBUG] Rezultate din DB: listings=${listingCount}, categories=${categoryCount}, messages=${totalMessageCount}, views=${totalViews}`
    );
    // --- SFÂRȘIT PAS DE DEPANARE ---

    res.status(200).json({
      totalListings: listingCount,
      totalCategories: categoryCount,
      totalMessages: totalMessageCount, // Câmp re-adăugat
      totalViews: totalViews,
      viewsLast30Days: viewsLast30Days,
    });
  } catch (error) {
    console.error("[DEBUG] A apărut o eroare în getStats:", error);
    res.status(500).json({ message: "Eroare la preluarea statisticilor." });
  }
};

// --- FUNCȚIE NOUĂ ADĂUGATĂ ---
const getListingAnalytics = async (req, res) => {
  const { businessId } = req.user;

  try {
    // 1. Găsim Top 5 cele mai vizualizate anunțuri ACTIVE
    const mostViewed = await prisma.listing.findMany({
      where: {
        businessId,
        status: "AVAILABLE", // Ne interesează doar anunțurile active
      },
      include: {
        _count: { select: { views: true } }, // Numărăm vizualizările
        images: {
          // Includem prima imagine pentru afișare în UI
          select: { url: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
      orderBy: {
        views: { _count: "desc" }, // Sortăm descrescător după numărul de vizualizări
      },
      take: 5, // Luăm doar primele 5
    });

    // 2. Găsim Top 5 cele mai PUȚIN vizualizate anunțuri ACTIVE
    const leastViewed = await prisma.listing.findMany({
      where: {
        businessId,
        status: "AVAILABLE",
      },
      include: {
        _count: { select: { views: true } },
        images: {
          select: { url: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
      orderBy: {
        views: { _count: "asc" }, // Sortăm crescător
      },
      take: 5,
    });

    res.status(200).json({ mostViewed, leastViewed });
  } catch (error) {
    console.error("[DEBUG] A apărut o eroare în getListingAnalytics:", error);
    res
      .status(500)
      .json({ message: "Eroare la preluarea statisticilor pentru anunțuri." });
  }
};

module.exports = { getStats, getListingAnalytics };
