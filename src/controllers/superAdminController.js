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

    const listingsCount = await prisma.listing.count({ where: { businessId } });
    const features = await prisma.feature.findMany({ select: { id: true, name: true } });

    const staticAttributes = [
      { id: "attr:make", name: "Marca", type: "STRING" },
      { id: "attr:model", name: "Model", type: "STRING" },
      { id: "attr:year", name: "An", type: "NUMBER" },
      { id: "attr:mileage", name: "Kilometraj", type: "NUMBER" },
      { id: "attr:price", name: "Pret", type: "NUMBER" },
      { id: "attr:engineCapacity", name: "Capacitate cilindrică", type: "NUMBER" },
      { id: "attr:powerHp", name: "Putere (CP)", type: "NUMBER" },
      { id: "attr:fuelType", name: "Combustibil", type: "STRING" },
      { id: "attr:gearbox", name: "Cutie de viteze", type: "STRING" },
      { id: "attr:drivetrain", name: "Tractiune", type: "STRING" },
      { id: "attr:bodyType", name: "Caroserie", type: "STRING" },
      { id: "attr:pollutionNorm", name: "Norma de poluare", type: "STRING" },
      { id: "attr:color", name: "Culoare", type: "STRING" },
      { id: "attr:vin", name: "VIN", type: "STRING" },
      { id: "attr:countryOfOrigin", name: "Tara de origine", type: "STRING" },
      { id: "attr:vatDeductible", name: "TVA deductibil", type: "BOOLEAN" },
      { id: "attr:noAccidents", name: "Fara accident", type: "BOOLEAN" },
      { id: "attr:serviceBook", name: "Carte service", type: "BOOLEAN" },
      { id: "attr:firstOwner", name: "Primul proprietar", type: "BOOLEAN" },
      { id: "attr:registeredInRo", name: "Inmatriculat", type: "BOOLEAN" }
    ];

    const featureAttributes = features.map(f => ({
      id: `feat:${f.id}`,
      name: f.name,
      type: "BOOLEAN"
    }));

    const attributes = [...staticAttributes, ...featureAttributes];

    const structure = [
      {
        id: "legacy-vehicule",
        name: "Vehicule",
        businessId: businessId,
        listingsCount: listingsCount,
        attributes: attributes
      }
    ];

    res.status(200).json(structure);
  } catch (error) {
    console.error("Error fetching business structure:", error);
    res.status(500).json({ message: "Eroare la preluarea structurii business-ului." });
  }
};

module.exports = { getPlatformStats, getAllBusinesses,getBusinessStructure };