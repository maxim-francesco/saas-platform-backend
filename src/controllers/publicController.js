// src/controllers/publicController.js
const prisma = require("../config/prismaClient");

const searchListings = async (req, res) => {
  try {
    // MODIFICARE 1: Extragem explicit `businessId` din query
    const {
      businessId,
      categoryId,
      q,
      page = 1,
      limit = 10,
      ...dynamicFilters
    } = req.query;

    const whereConditions = [];

    // MODIFICARE 2: Adăugăm `businessId` ca un filtru principal, dacă există
    if (businessId) {
      whereConditions.push({ businessId: businessId });
    }

    // Restul filtrelor de bază rămân la fel
    if (categoryId) {
      whereConditions.push({ categoryId: categoryId });
    }
    if (q) {
      whereConditions.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    // Logica pentru filtrele dinamice rămâne neschimbată
    for (const key in dynamicFilters) {
      const value = dynamicFilters[key];
      let attributeName = key;
      let operator;

      if (key.endsWith("_max")) {
        attributeName = key.replace("_max", "");
        operator = "lte";
      } else if (key.endsWith("_min")) {
        attributeName = key.replace("_min", "");
        operator = "gte";
      }

      const isNumeric = !isNaN(parseFloat(value)) && operator;

      const attributeCondition = {
        attribute: {
          name: {
            equals: attributeName.replace(/_/g, " "),
            mode: "insensitive",
          },
        },
      };

      if (operator) {
        attributeCondition[isNumeric ? "numberValue" : "stringValue"] = {
          [operator]: isNumeric ? parseFloat(value) : value,
        };
      } else {
        attributeCondition[isNumeric ? "numberValue" : "stringValue"] = {
          equals: isNumeric ? parseFloat(value) : value,
          mode: "insensitive",
        };
      }

      whereConditions.push({
        attributeValues: {
          some: attributeCondition,
        },
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // Restul funcției (paginare, query, etc.) rămâne la fel...
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const listings = await prisma.listing.findMany({
      where,
      skip,
      take,
      include: {
        category: { select: { name: true } },
        images: { select: { url: true }, take: 1 },
        attributeValues: {
          include: {
            attribute: { select: { name: true, type: true } },
          },
        },
      },
    });

    const totalListings = await prisma.listing.count({ where });

    res.status(200).json({
      data: listings,
      pagination: {
        total: totalListings,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalListings / limit),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Eroare la căutarea anunțurilor." });
  }
};

const getPublicListingById = async (req, res) => {
  try {
    const { listingId } = req.params;
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        category: { select: { name: true } },
        images: { select: { url: true } },
        attributeValues: {
          include: {
            attribute: { select: { name: true, type: true } },
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    }
    res.status(200).json(listing);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea anunțului." });
  }
};

const getPublicAttributesForCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const attributes = await prisma.attribute.findMany({
      where: { categoryId: categoryId },
      orderBy: { name: "asc" },
    });
    res.status(200).json(attributes);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea atributelor." });
  }
};

module.exports = {
  searchListings,
  getPublicListingById,
  getPublicAttributesForCategory,
};
