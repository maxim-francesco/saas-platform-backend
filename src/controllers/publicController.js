// src/controllers/publicController.js
const prisma = require("../config/prismaClient");
const { sendContactNotification } = require("../services/emailService");


// src/controllers/publicController.js

const normalizeString = (str) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

const matchAttributeValue = (dbValue, filterValue) => {
  const normDb = normalizeString(dbValue);
  const normFilter = normalizeString(filterValue);

  if (normFilter === "diesel" || normFilter === "motorina") {
    return normDb.includes("diesel") || normDb.includes("motorina") || normDb === "d" || normDb === "diese";
  }
  
  if (normFilter === "benzina") {
    return normDb.includes("benzina");
  }

  if (normFilter === "automata" || normFilter === "automat") {
    return normDb.includes("automat");
  }

  if (normFilter === "manuala" || normFilter === "manual" || normFilter === "manula") {
    return normDb.includes("manual") || normDb.includes("manula");
  }

  // Fallback generic match
  return normDb.includes(normFilter) || normFilter.includes(normDb);
};

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
      search,
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
    
    const searchVal = q || search;
    if (searchVal) {
      whereConditions.push({
        OR: [
          { title: { contains: searchVal, mode: "insensitive" } },
          { description: { contains: searchVal, mode: "insensitive" } },
        ],
      });
    }

    // Aceasta este versiunea NOUĂ și CORECTĂ
    for (const key in dynamicFilters) {
      const value = dynamicFilters[key];
      
      let cleanKey = key;
      if (key.startsWith("attr_")) {
        cleanKey = key.substring(5);
      }
      
      const attributeName = cleanKey.replace(/_/g, " ");

      let attributeCondition;

      if (value === "true" || value === "false") {
        // Filtru boolean
        attributeCondition = {
          attribute: {
            name: { equals: attributeName, mode: "insensitive" },
          },
          booleanValue: { equals: value === "true" },
        };

      } else if (cleanKey.endsWith("_max")) {
        // Interval numeric - maxim
        const attrNameNoSuffix = attributeName.replace(" max", "");
        attributeCondition = {
          attribute: {
            name: { equals: attrNameNoSuffix, mode: "insensitive" },
          },
          numberValue: { lte: parseFloat(value) },
        };

      } else if (cleanKey.endsWith("_min")) {
        // Interval numeric - minim
        const attrNameNoSuffix = attributeName.replace(" min", "");
        attributeCondition = {
          attribute: {
            name: { equals: attrNameNoSuffix, mode: "insensitive" },
          },
          numberValue: { gte: parseFloat(value) },
        };

      } else {
        // Filtru text cu potrivire inteligentă (diacritice, spații, case-insensitive, sinonime)
        const distinctDbValues = await prisma.attributeValue.findMany({
          where: {
            attribute: {
              name: { equals: attributeName, mode: "insensitive" },
            },
            stringValue: { not: null },
          },
          distinct: ["stringValue"],
          select: { stringValue: true },
        });
        
        const dbStrings = distinctDbValues.map(v => v.stringValue);
        const filterValues = Array.isArray(value) ? value : [value];
        
        const matchedDbStrings = dbStrings.filter(dbVal => 
          filterValues.some(v => matchAttributeValue(dbVal, v))
        );
        
        attributeCondition = {
          attribute: {
            name: { equals: attributeName, mode: "insensitive" },
          },
          stringValue: { in: matchedDbStrings },
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

const getListingsCsvFeed = async (req, res) => {
  const { businessId } = req.query;

  if (!businessId) {
    return res.status(400).json({ message: "businessId este obligatoriu." });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      return res.status(404).json({ message: "Afacerea nu a fost găsită." });
    }

    const listings = await prisma.listing.findMany({
      where: {
        businessId,
        status: "AVAILABLE",
      },
      include: {
        images: {
          orderBy: { order: "asc" },
        },
        attributeValues: {
          include: {
            attribute: true,
          },
        },
      },
    });

    // Strip HTML helper
    const stripHtml = (html) => {
      if (!html) return "";
      let text = html
        .replace(/<\/p>/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/div>/gi, " ");
      text = text.replace(/<[^>]*>/g, "");
      text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
      // Collapse all whitespaces, including newlines, into a single space
      text = text.replace(/\s+/g, " ");
      return text.trim();
    };

    // Helper to get attribute value
    const getAttrValue = (listing, name) => {
      const av = listing.attributeValues?.find(
        (item) => item.attribute?.name?.toLowerCase() === name.toLowerCase()
      );
      if (!av) return "";
      if (av.stringValue !== null && av.stringValue !== undefined) return av.stringValue;
      if (av.numberValue !== null && av.numberValue !== undefined) return av.numberValue.toString();
      if (av.booleanValue !== null && av.booleanValue !== undefined) return av.booleanValue ? "Da" : "Nu";
      return "";
    };

    // Construct CSV content
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = str.toString().replace(/"/g, '""');
      return `"${clean}"`;
    };

    const headers = [
      "Link",
      "ID",
      "Marca",
      "Model",
      "Year",
      "Mileage",
      "Fuel_Type",
      "Transmise",
      "Capacitate Cilindrica",
      "Putere (CP)",
      "Price",
      "image_link",
      "additional_image",
      "Availability",
      "Condition",
      "Title",
      "Description",
      "quantity_to_sell_on_facebook"
    ];

    const csvLines = [headers.join(";")];

    for (const listing of listings) {
      const id = listing.autovitId ? listing.autovitId.toString() : listing.id;
      
      // Extragere marca si model din titlu
      const titleWords = listing.title.trim().split(/\s+/);
      const marca = titleWords[0] || "";
      const model = titleWords[1] || "";

      const an = getAttrValue(listing, "An fabricație") || getAttrValue(listing, "An");
      const kilometraj = listing.mileage || getAttrValue(listing, "Kilometraj");
      const combustibil = getAttrValue(listing, "Combustibil");
      const cutie_viteze = getAttrValue(listing, "Transmisie") || getAttrValue(listing, "Cutie de viteze");
      const capacitate_cilindrica = getAttrValue(listing, "Capacitate cilindrică");
      const putere_cp = getAttrValue(listing, "Putere (CP)") || getAttrValue(listing, "Putere");

      // Pret
      let pret = "";
      if (listing.price) {
        pret = `${listing.price} EUR`;
      } else {
        const pVal = getAttrValue(listing, "Preț") || getAttrValue(listing, "Pret") || getAttrValue(listing, "price");
        if (pVal) {
          pret = `${pVal} EUR`;
        }
      }

      // Build link
      let link = business.listingUrlPattern || "https://example.com/anunt/{id}";
      if (business.id === "cmhomcpoi02x1ut2cpips3mo3") {
        link = "https://www.carsleasing.ro/stoc/{id}";
      }
      if (link.includes("{slug}")) {
        link = link.replace("{slug}", listing.slug || listing.id);
      }
      if (link.includes("{id}")) {
        link = link.replace("{id}", listing.id);
      }

      // Build image links
      const imageLink = listing.images?.[0]?.url || "";
      const additionalImageLinks = listing.images
        ? listing.images.slice(1).map((img) => img.url).join(",")
        : "";

      const availability = "In Stock";
      const condition = "Used";
      const title = listing.title;
      const description = stripHtml(listing.description);

      const row = [
        escapeCsv(link),
        escapeCsv(id),
        escapeCsv(marca),
        escapeCsv(model),
        escapeCsv(an),
        escapeCsv(kilometraj),
        escapeCsv(combustibil),
        escapeCsv(cutie_viteze),
        escapeCsv(capacitate_cilindrica),
        escapeCsv(putere_cp),
        escapeCsv(pret),
        escapeCsv(imageLink),
        escapeCsv(additionalImageLinks),
        escapeCsv(availability),
        escapeCsv(condition),
        escapeCsv(title),
        escapeCsv(description),
        escapeCsv("1")
      ];

      csvLines.push(row.join(";"));
    }

    const csvContent = csvLines.join("\n");

    // Set headers for download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=listings-feed.csv");

    // Send UTF-8 BOM byte so Excel recognizes diacritics
    res.write("\ufeff");
    res.end(csvContent);
  } catch (error) {
    console.error("Eroare la generarea feed-ului CSV:", error);
    res.status(500).json({ message: "Eroare la generarea feed-ului CSV." });
  }
};

module.exports = {
  searchListings,
  getPublicListingById,
  getPublicAttributesForCategory,
  getUniqueAttributeValues,
  getAttributeStats,
  submitContactForm,
  getListingsCsvFeed,
};
