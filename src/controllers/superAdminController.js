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

const getBusinessStructure = async (req, res) => {
  try {
    const { businessId } = req.params;

    const structure = await prisma.category.findMany({
      where: { businessId: businessId },
      include: {
        attributes: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    res.status(200).json(structure);
  } catch (error) {
    console.error("Error fetching business structure:", error);
    res.status(500).json({ message: "Eroare la preluarea structurii business-ului." });
  }
};

module.exports = { getPlatformStats, getAllBusinesses,getBusinessStructure };