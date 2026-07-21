// src/controllers/networkController.js
const prisma = require("../config/prismaClient");
const { toNetworkDealer } = require("../utils/networkSerializer");

const getNetworkSettings = async (req, res) => {
  const { businessId } = req.user;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        networkEnabled: true,
        city: true,
        networkDisplayName: true,
        networkContactPhone: true,
        networkContactEmail: true,
        name: true,
      },
    });

    if (!business) {
      return res.status(404).json({ message: "Business-ul nu a fost găsit." });
    }

    return res.status(200).json(business);
  } catch (error) {
    console.error("Eroare getNetworkSettings:", error);
    return res.status(500).json({ message: "Eroare la obținerea setărilor de rețea." });
  }
};

const updateNetworkSettings = async (req, res) => {
  const { businessId } = req.user;
  const { networkEnabled, city, networkDisplayName, networkContactPhone, networkContactEmail } = req.body;

  try {
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        networkEnabled,
        city,
        networkDisplayName,
        networkContactPhone,
        networkContactEmail,
      },
      select: {
        networkEnabled: true,
        city: true,
        networkDisplayName: true,
        networkContactPhone: true,
        networkContactEmail: true,
        name: true,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare updateNetworkSettings:", error);
    return res.status(500).json({ message: "Eroare la actualizarea setărilor de rețea." });
  }
};

const getNetworkDealers = async (req, res) => {
  const { businessId } = req.user;

  try {
    const dealers = await prisma.business.findMany({
      where: {
        networkEnabled: true,
        id: { not: businessId },
      },
    });

    const sanitizedDealers = dealers.map(toNetworkDealer);
    return res.status(200).json(sanitizedDealers);
  } catch (error) {
    console.error("Eroare getNetworkDealers:", error);
    return res.status(500).json({ message: "Eroare la obținerea listei de dealeri." });
  }
};

module.exports = {
  getNetworkSettings,
  updateNetworkSettings,
  getNetworkDealers,
};
