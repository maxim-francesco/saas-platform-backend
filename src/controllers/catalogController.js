const prisma = require("../config/prismaClient");

const getMakes = async (req, res) => {
  try {
    const makes = await prisma.make.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json(makes);
  } catch (error) {
    console.error("Error in getMakes:", error);
    res.status(500).json({ message: "Eroare la preluarea mărcilor." });
  }
};

const getModelsByMake = async (req, res) => {
  const { makeId } = req.params;
  try {
    const models = await prisma.carModel.findMany({
      where: { makeId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json(models);
  } catch (error) {
    console.error("Error in getModelsByMake:", error);
    res.status(500).json({ message: "Eroare la preluarea modelelor." });
  }
};

const getFeatures = async (req, res) => {
  try {
    const features = await prisma.feature.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        group: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const grouped = {
      SAFETY: [],
      COMFORT: [],
      MULTIMEDIA: [],
      EXTERIOR: [],
      SERVICES: [],
    };

    for (const f of features) {
      if (grouped[f.group]) {
        grouped[f.group].push({
          id: f.id,
          name: f.name,
          slug: f.slug,
        });
      }
    }

    res.status(200).json(grouped);
  } catch (error) {
    console.error("Error in getFeatures:", error);
    res.status(500).json({ message: "Eroare la preluarea dotărilor." });
  }
};

module.exports = {
  getMakes,
  getModelsByMake,
  getFeatures,
};
