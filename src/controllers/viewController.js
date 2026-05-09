// src/controllers/viewController.js
const prisma = require("../config/prismaClient");

// Resetează toate vizualizările pentru un business (reset global)
const resetViews = async (req, res) => {
  const { businessId } = req.user;

  try {
    const deleteResult = await prisma.view.deleteMany({
      where: {
        businessId: businessId,
      },
    });

    res.status(200).json({
      message: `Resetare completă. Au fost șterse ${deleteResult.count} vizualizări.`,
    });
  } catch (error) {
    res.status(500).json({ message: "Eroare la resetarea vizualizărilor." });
  }
};

// Resetează vizualizările pentru un singur anunț
const resetViewsForListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    // Verificare de securitate: anunțul trebuie să aparțină business-ului
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId: businessId },
    });

    if (!listing) {
      return res.status(404).json({
        message: "Anunțul nu a fost găsit sau nu aveți acces la el.",
      });
    }

    const deleteResult = await prisma.view.deleteMany({
      where: {
        listingId: listingId,
        businessId: businessId,
      },
    });

    res.status(200).json({
      message: `Au fost șterse ${deleteResult.count} vizualizări pentru acest anunț.`,
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    console.error("Eroare la resetarea vizualizărilor anunțului:", error);
    res.status(500).json({
      message: "Eroare la resetarea vizualizărilor anunțului.",
    });
  }
};

module.exports = { resetViews, resetViewsForListing };
