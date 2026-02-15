const prisma = require("../config/prismaClient");

const getPlatformStats = async (req, res) => {
  try {
    const [totalBusinesses, totalListings, totalViews] = await prisma.$transaction([
      prisma.business.count(),
      prisma.listing.count({ where: { status: "AVAILABLE" } }),
      prisma.view.count(),
    ]);

    res.status(200).json({ totalBusinesses, totalListings, totalViews });
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea statisticilor globale." });
  }
};

// În superAdminController.js
const getAllBusinesses = async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      include: {
        users: { select: { email: true }, take: 1 }, // <--- ADAUGĂ ASTA
        _count: { select: { listings: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(businesses);
  } catch (error) {
    res.status(500).json({ message: "Eroare..." });
  }
};

module.exports = { getPlatformStats, getAllBusinesses };