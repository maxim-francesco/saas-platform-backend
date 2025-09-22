// src/controllers/publicController.js
const prisma = require("../config/prismaClient");

const searchListings = async (req, res) => {
  try {
    const {
      categoryId,
      q,
      page = 1,
      limit = 10,
      ...dynamicFilters
    } = req.query;

    // Vom construi o listă de condiții pe care le vom uni la final cu AND
    const whereConditions = [];

    // 1. Adăugăm filtrele de bază la lista de condiții
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

    // 2. Iterăm prin filtrele dinamice și creăm o condiție `some` pentru fiecare
    for (const key in dynamicFilters) {
      const value = dynamicFilters[key];
      let attributeName = key;
      let conditionType = "equals";
      let operator;

      if (key.endsWith("_max")) {
        attributeName = key.replace("_max", "");
        operator = "lte"; // Less than or equal
      } else if (key.endsWith("_min")) {
        attributeName = key.replace("_min", "");
        operator = "gte"; // Greater than or equal
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
        // Pentru _min/_max
        attributeCondition[isNumeric ? "numberValue" : "stringValue"] = {
          [operator]: isNumeric ? parseFloat(value) : value,
        };
      } else {
        // Pentru egalitate
        attributeCondition[isNumeric ? "numberValue" : "stringValue"] = {
          equals: isNumeric ? parseFloat(value) : value,
          mode: "insensitive",
        };
      }

      // Adăugăm o condiție complexă: "anunțul trebuie să aibă CEL PUȚIN UN atribut care..."
      whereConditions.push({
        attributeValues: {
          some: attributeCondition,
        },
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // 3. Paginare
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // 4. Executăm query-ul final
    const listings = await prisma.listing.findMany({
      where,
      skip,
      take,
      include: {
        category: { select: { name: true } },
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

module.exports = { searchListings };
