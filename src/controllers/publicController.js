// src/controllers/publicController.js
const prisma = require("../config/prismaClient");
const { sendContactNotification } = require("../services/emailService");


// src/controllers/publicController.js

const getUniqueAttributeValues = async (req, res) => {
  try {
    const { attributeId } = req.params;
    const distinctValues = await prisma.attributeValue.findMany({
      where: {
        attributeId: attributeId,
        stringValue: { not: null }, // Ne asigurăm că luăm doar valorile de tip text
      },
      distinct: ["stringValue"],
      select: {
        stringValue: true,
      },
      orderBy: {
        stringValue: "asc",
      },
    });
    // Transformăm array-ul de obiecte într-un array simplu de string-uri
    const values = distinctValues.map((item) => item.stringValue);
    res.status(200).json(values);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea valorilor unice." });
  }
};

const searchListings = async (req, res) => {
  try {
    const {
      businessId,
      categoryId,
      q,
      page = 1,
      limit = 10,
      sortBy = "newest",
      ...dynamicFilters
    } = req.query;

    const whereConditions = [];

    whereConditions.push({ status: "AVAILABLE" });

    if (businessId) {
      whereConditions.push({ businessId: businessId });
    }
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

    // Aceasta este versiunea NOUĂ și CORECTĂ
    for (const key in dynamicFilters) {
  const value = dynamicFilters[key];
  const attributeName = key.replace(/_/g, " ");

  let attributeCondition;

  if (value === "true" || value === "false") {
    // Filtru boolean
    attributeCondition = {
      attribute: {
        name: { equals: attributeName, mode: "insensitive" },
      },
      booleanValue: { equals: value === "true" },
    };

  } else if (key.endsWith("_max")) {
    // Interval numeric - maxim
    const attrNameNoSuffix = attributeName.replace(" max", "");
    attributeCondition = {
      attribute: {
        name: { equals: attrNameNoSuffix, mode: "insensitive" },
      },
      numberValue: { lte: parseFloat(value) },
    };

  } else if (key.endsWith("_min")) {
    // Interval numeric - minim
    const attrNameNoSuffix = attributeName.replace(" min", "");
    attributeCondition = {
      attribute: {
        name: { equals: attrNameNoSuffix, mode: "insensitive" },
      },
      numberValue: { gte: parseFloat(value) },
    };

  } else if (Array.isArray(value)) {
    // ─── NOU: Valori multiple pentru același atribut (ex: Combustibil=Benzina&Combustibil=Hybrid) ───
    whereConditions.push({
      OR: value.map(v => ({
        attributeValues: {
          some: {
            attribute: {
              name: { equals: attributeName, mode: "insensitive" },
            },
            stringValue: { equals: v, mode: "insensitive" },
          },
        },
      })),
    });
    continue; // Sărim peste adăugarea normală de mai jos

  } else {
    // Filtru text simplu
    attributeCondition = {
      attribute: {
        name: { equals: attributeName, mode: "insensitive" },
      },
      stringValue: { equals: value, mode: "insensitive" },
    };
  }

  if (attributeCondition) {
    whereConditions.push({
      attributeValues: {
        some: attributeCondition,
      },
    });
  }
}

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // --- LOGICA DE SORTARE ACTUALIZATĂ ---
    let orderBy = { createdAt: "desc" }; // Default: cele mai noi
    switch (sortBy) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "price_asc":
        orderBy = { price: "asc" };
        break;
      case "price_desc":
        orderBy = { price: "desc" };
        break;
      case "mileage_asc":
        orderBy = { mileage: "asc" };
        break;
      case "mileage_desc":
        orderBy = { mileage: "desc" };
        break;
    }
    // --- SFÂRȘIT LOGICĂ DE SORTARE ---

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const listings = await prisma.listing.findMany({
      where,
      skip,
      take,
      orderBy, // Folosim obiectul de sortare actualizat
      include: {
        category: { select: { name: true } },
        images: {
          select: { url: true },
          orderBy: { order: "asc" }, // <-- ADAUGĂ ACEASTĂ LINIE
          take: 1,
        },
        attributeValues: {
          include: {
            attribute: { include: { attributeGroup: { select: { name: true } } } },
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
        images: { orderBy: { order: "asc" } },
        attributeValues: {
          include: {
            attribute: { include: { attributeGroup: { select: { name: true } } } },
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    }

    // --- ✅ LOGICĂ NOUĂ ADĂUGATĂ ---
    // Înregistrăm vizualizarea în fundal, fără a bloca răspunsul principal
    prisma.view
      .create({
        data: {
          businessId: listing.businessId,
          listingId: listing.id,
        },
      })
      .catch((err) => console.error("Failed to record view:", err)); // Prindem orice eroare ca să nu crape request-ul
    // --- SFÂRȘIT LOGICĂ NOUĂ ---

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

const getAttributeStats = async (req, res) => {
  try {
    const { attributeId } = req.params;
    const stats = await prisma.attributeValue.aggregate({
      where: {
        attributeId: attributeId,
        numberValue: { not: null },
      },
      _min: { numberValue: true },
      _max: { numberValue: true },
    });
    res.status(200).json({
      min: stats._min.numberValue || 0,
      max: stats._max.numberValue || 100000, // Valori default în caz că nu se găsește nimic
    });
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea statisticilor." });
  }
};

const submitContactForm = async (req, res) => {
  const { businessId, name, email, phone, message } = req.body;

  if (!businessId || !name || !email || !message) {
    return res.status(400).json({ message: "Toate câmpurile obligatorii trebuie completate." });
  }

  try {
    const newMessage = await prisma.message.create({
      data: { name, email, phone, message, businessId },
    });

    // ✅ Trimite email pentru clienții configurați
    const SEVENCENTER_BUSINESS_EMAIL = process.env.SEVENCENTER_BUSINESS_EMAIL;
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { users: { select: { email: true }, take: 1 } },
    });

    const businessUserEmail = business?.users?.[0]?.email;
    if (businessUserEmail === SEVENCENTER_BUSINESS_EMAIL) {
      sendContactNotification({ name, email, phone, message })
        .then(() => console.log("[Email] Notificare trimisă către Seven Center Auto"))
        .catch((err) => console.error("[Email] Eroare la trimitere:", err.message));
    } else if (businessUserEmail === "contact@stefan.ro") {
      sendContactNotification({ toEmail: "stefanautogvr@gmail.com", name, email, phone, message })
        .then(() => console.log("[Email] Notificare trimisă către Stefan Auto"))
        .catch((err) => console.error("[Email] Eroare la trimitere:", err.message));
    } else if (businessUserEmail === "contact@via-automobile.ro") {
      sendContactNotification({ toEmail: "via.automobile@yahoo.com", name, email, phone, message })
        .then(() => console.log("[Email] Notificare trimisă către Via Automobile"))
        .catch((err) => console.error("[Email] Eroare la trimitere:", err.message));
    }

    res.status(201).json({
      message: "Mesajul tău a fost trimis cu succes!",
      data: newMessage,
    });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({ message: "Afacerea specificată nu a fost găsită." });
    }
    res.status(500).json({ message: "Eroare la trimiterea mesajului." });
  }
};

module.exports = {
  searchListings,
  getPublicListingById,
  getPublicAttributesForCategory,
  getUniqueAttributeValues,
  getAttributeStats,
  submitContactForm,
};
