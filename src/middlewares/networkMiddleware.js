// src/middlewares/networkMiddleware.js
const prisma = require("../config/prismaClient");

const requireNetworkMember = async (req, res, next) => {
  const businessId = req.user?.businessId;

  if (!businessId) {
    return res.status(403).json({ message: "Nu ești membru al rețelei de dealeri." });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        networkEnabled: true,
      },
    });

    if (!business || business.networkEnabled !== true) {
      return res.status(403).json({ message: "Nu ești membru al rețelei de dealeri." });
    }

    req.networkBusinessId = businessId;
    next();
  } catch (error) {
    console.error("Eroare în requireNetworkMember middleware:", error);
    return res.status(500).json({ message: "A apărut o eroare pe server." });
  }
};

module.exports = {
  requireNetworkMember,
};
