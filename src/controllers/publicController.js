// src/controllers/publicController.js
const prisma = require("../config/prismaClient");
const { sendContactNotification } = require("../services/emailService");
const { toLegacyListing } = require("../utils/compatSerializer");

const COLOR_MAP = {
  BLACK: "Negru",
  GREY: "Gri",
  WHITE: "Alb",
  BLUE: "Albastru",
  RED: "Rosu",
  BROWN: "Maro",
  SILVER: "Argintiu",
  ORANGE: "Portocaliu",
  GREEN: "Verde",
  PURPLE: "Mov",
  GOLD: "Auriu",
  BEIGE: "Bej",
  YELLOW: "Galben",
  OTHER: "Alta"
};

const FUEL_TYPE_MAP = {
  PETROL: "Benzina",
  DIESEL: "Diesel",
  PETROL_LPG: "Benzina + GPL",
  LPG: "GPL",
  HYBRID: "Hibrid",
  PLUGIN_HYBRID: "Plug-in Hybrid",
  MILD_HYBRID: "Mild Hybrid",
  ELECTRIC: "Electric"
};

const GEARBOX_MAP = {
  MANUAL: "Manuala",
  AUTOMATIC: "Automata"
};

const DRIVETRAIN_MAP = {
  FWD: "Fata",
  RWD: "Spate",
  AWD: "Integrala"
};

const BODY_TYPE_MAP = {
  SUV: "SUV",
  SEDAN: "Berlina",
  HATCHBACK: "Hatchback",
  BREAK: "Break",
  COUPE: "Coupe",
  CABRIO: "Cabrio",
  MONOVOLUM: "Monovolum",
  VAN: "Van",
  PICKUP: "Pickup"
};

const POLLUTION_NORM_MAP = {
  EURO_1: "Euro 1",
  EURO_2: "Euro 2",
  EURO_3: "Euro 3",
  EURO_4: "Euro 4",
  EURO_5: "Euro 5",
  EURO_6: "Euro 6",
  EURO_6D: "Euro 6d",
  NON_EURO: "Non-Euro"
};

const UUID_TO_KEY = {
  "cmmnj2p3m00fip828op7z1oup": "make",
  "cmmnj2p5h00fkp828mt1mpj58": "model",
  "cmmnj2p1r00fgp828rnjb8l8e": "year",
  "cmmnj2p7d00fmp828fw53hgek": "mileage",
  "cmmnj2ozw00fep828js0dmn5h": "price",
  "cmmnj2ne900dwp8286bzcygsg": "engineCapacity",
  "cmmnj2ng700dyp828g040kyxf": "powerHp",
  "cmmnj2nca00dup8287h8ylag0": "fuelType",
  "cmmnj2ni600e0p828ukv3tcw3": "gearbox"
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

    const whereConditions = [{ status: "AVAILABLE" }];

    if (businessId) {
      whereConditions.push({ businessId });
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

    // Map EAV filters to fixed v2 columns
    for (const key in dynamicFilters) {
      if (!key.startsWith("attr_")) continue;
      
      const rawVal = dynamicFilters[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;
      
      const cleanKey = key.substring(5).toLowerCase();
      const valArray = Array.isArray(rawVal) ? rawVal : [rawVal];

      if (cleanKey === 'combustibil' || cleanKey === 'tip_carburant') {
        const mappedEnums = [];
        valArray.forEach(v => {
          const norm = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (norm.includes("diesel") || norm.includes("motorina")) mappedEnums.push("DIESEL");
          else if (norm.includes("benzina")) {
            if (norm.includes("gpl")) mappedEnums.push("PETROL_LPG");
            else mappedEnums.push("PETROL");
          }
          else if (norm.includes("gpl")) mappedEnums.push("LPG");
          else if (norm.includes("plug")) mappedEnums.push("PLUGIN_HYBRID");
          else if (norm.includes("mild")) mappedEnums.push("MILD_HYBRID");
          else if (norm.includes("hybrid") || norm.includes("hibrid")) mappedEnums.push("HYBRID");
          else if (norm.includes("electric")) mappedEnums.push("ELECTRIC");
        });
        if (mappedEnums.length > 0) {
          whereConditions.push({ fuelType: { in: mappedEnums } });
        }
      }
      else if (cleanKey === 'cutie_de_viteze' || cleanKey === 'cutie_viteze' || cleanKey === 'transmisie') {
        const mappedEnums = [];
        valArray.forEach(v => {
          const norm = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (norm.includes("automat")) mappedEnums.push("AUTOMATIC");
          else if (norm.includes("manual")) mappedEnums.push("MANUAL");
        });
        if (mappedEnums.length > 0) {
          whereConditions.push({ gearbox: { in: mappedEnums } });
        }
      }
      else if (cleanKey === 'marca') {
        whereConditions.push({
          make: {
            name: {
              in: valArray,
              mode: 'insensitive'
            }
          }
        });
      }
      else if (cleanKey === 'model') {
        whereConditions.push({
          model: {
            name: {
              in: valArray,
              mode: 'insensitive'
            }
          }
        });
      }
      else if (cleanKey.endsWith('_min')) {
        const fieldName = cleanKey.replace('_min', '');
        const valParsed = parseFloat(valArray[0]);
        if (!isNaN(valParsed)) {
          if (fieldName === 'an' || fieldName === 'an_fabricatie' || fieldName === 'anul_fabricatiei') {
            whereConditions.push({ year: { gte: Math.round(valParsed) } });
          } else if (fieldName === 'pret' || fieldName === 'price') {
            whereConditions.push({ price: { gte: valParsed } });
          } else if (fieldName === 'kilometraj' || fieldName === 'km') {
            whereConditions.push({ mileage: { gte: Math.round(valParsed) } });
          } else if (fieldName === 'capacitate_cilindrica') {
            whereConditions.push({ engineCapacity: { gte: Math.round(valParsed) } });
          } else if (fieldName === 'putere' || fieldName === 'putere_cp') {
            whereConditions.push({ powerHp: { gte: Math.round(valParsed) } });
          }
        }
      }
      else if (cleanKey.endsWith('_max')) {
        const fieldName = cleanKey.replace('_max', '');
        const valParsed = parseFloat(valArray[0]);
        if (!isNaN(valParsed)) {
          if (fieldName === 'an' || fieldName === 'an_fabricatie' || fieldName === 'anul_fabricatiei') {
            whereConditions.push({ year: { lte: Math.round(valParsed) } });
          } else if (fieldName === 'pret' || fieldName === 'price') {
            whereConditions.push({ price: { lte: valParsed } });
          } else if (fieldName === 'kilometraj' || fieldName === 'km') {
            whereConditions.push({ mileage: { lte: Math.round(valParsed) } });
          } else if (fieldName === 'capacitate_cilindrica') {
            whereConditions.push({ engineCapacity: { lte: Math.round(valParsed) } });
          } else if (fieldName === 'putere' || fieldName === 'putere_cp') {
            whereConditions.push({ powerHp: { lte: Math.round(valParsed) } });
          }
        }
      }
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    let orderBy = { createdAt: "desc" };
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

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const listings = await prisma.listing.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      }
    });

    const totalListings = await prisma.listing.count({ where });
    const legacyListings = listings.map(l => toLegacyListing(l, { mode: 'search' }));

    res.status(200).json({
      data: legacyListings,
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
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    }

    prisma.view
      .create({
        data: {
          businessId: listing.businessId,
          listingId: listing.id,
        },
      })
      .catch((err) => console.error("Failed to record view:", err));

    res.status(200).json(toLegacyListing(listing, { mode: 'byId' }));
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea anunțului." });
  }
};

const getPublicAttributesForCategory = async (req, res) => {
  try {
    const staticAttributes = [
      { id: "attr:make", name: "Marca", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:model", name: "Model", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:year", name: "An", type: "NUMBER", categoryId: "legacy-vehicule" },
      { id: "attr:mileage", name: "Kilometraj", type: "NUMBER", categoryId: "legacy-vehicule" },
      { id: "attr:price", name: "Pret", type: "NUMBER", categoryId: "legacy-vehicule" },
      { id: "attr:engineCapacity", name: "Capacitate cilindrică", type: "NUMBER", categoryId: "legacy-vehicule" },
      { id: "attr:powerHp", name: "Putere (CP)", type: "NUMBER", categoryId: "legacy-vehicule" },
      { id: "attr:fuelType", name: "Combustibil", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:gearbox", name: "Cutie de viteze", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:drivetrain", name: "Tractiune", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:bodyType", name: "Caroserie", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:pollutionNorm", name: "Norma de poluare", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:color", name: "Culoare", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:vin", name: "VIN", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:countryOfOrigin", name: "Tara de origine", type: "STRING", categoryId: "legacy-vehicule" },
      { id: "attr:vatDeductible", name: "TVA deductibil", type: "BOOLEAN", categoryId: "legacy-vehicule" },
      { id: "attr:noAccidents", name: "Fara accident", type: "BOOLEAN", categoryId: "legacy-vehicule" },
      { id: "attr:serviceBook", name: "Carte service", type: "BOOLEAN", categoryId: "legacy-vehicule" },
      { id: "attr:firstOwner", name: "Primul proprietar", type: "BOOLEAN", categoryId: "legacy-vehicule" },
      { id: "attr:registeredInRo", name: "Inmatriculat", type: "BOOLEAN", categoryId: "legacy-vehicule" }
    ];

    const features = await prisma.feature.findMany({ select: { name: true, slug: true } });
    const featureAttributes = features.map(f => ({
      id: `attr:feature:${f.slug}`,
      name: f.name,
      type: "BOOLEAN",
      categoryId: "legacy-vehicule"
    }));

    res.status(200).json([...staticAttributes, ...featureAttributes]);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea atributelor." });
  }
};

const getUniqueAttributeValues = async (req, res) => {
  try {
    const { attributeId } = req.params;
    
    let key = attributeId;
    if (attributeId.startsWith("attr:")) {
      key = attributeId.substring(5);
    } else {
      key = UUID_TO_KEY[attributeId] || attributeId;
    }

    let values = [];
    if (key === 'make' || key === 'marca') {
      const distinctMakes = await prisma.make.findMany({
        select: { name: true },
        orderBy: { name: "asc" }
      });
      values = distinctMakes.map(m => m.name);
    }
    else if (key === 'model') {
      const distinctModels = await prisma.carModel.findMany({
        select: { name: true },
        orderBy: { name: "asc" }
      });
      values = distinctModels.map(m => m.name);
    }
    else if (key === 'fuelType' || key === 'combustibil') {
      const distinctListings = await prisma.listing.findMany({
        where: { fuelType: { not: null } },
        distinct: ["fuelType"],
        select: { fuelType: true }
      });
      values = distinctListings.map(l => FUEL_TYPE_MAP[l.fuelType] || l.fuelType);
    }
    else if (key === 'gearbox' || key === 'cutie de viteze') {
      const distinctListings = await prisma.listing.findMany({
        where: { gearbox: { not: null } },
        distinct: ["gearbox"],
        select: { gearbox: true }
      });
      values = distinctListings.map(l => GEARBOX_MAP[l.gearbox] || l.gearbox);
    }
    else if (key === 'drivetrain' || key === 'tractiune') {
      const distinctListings = await prisma.listing.findMany({
        where: { drivetrain: { not: null } },
        distinct: ["drivetrain"],
        select: { drivetrain: true }
      });
      values = distinctListings.map(l => DRIVETRAIN_MAP[l.drivetrain] || l.drivetrain);
    }
    else if (key === 'bodyType' || key === 'caroserie') {
      const distinctListings = await prisma.listing.findMany({
        where: { bodyType: { not: null } },
        distinct: ["bodyType"],
        select: { bodyType: true }
      });
      values = distinctListings.map(l => BODY_TYPE_MAP[l.bodyType] || l.bodyType);
    }
    else if (key === 'color' || key === 'culoare') {
      const distinctDetails = await prisma.listing.findMany({
        where: { colorDetail: { not: null } },
        distinct: ["colorDetail"],
        select: { colorDetail: true }
      });
      const distinctEnums = await prisma.listing.findMany({
        where: { color: { not: null } },
        distinct: ["color"],
        select: { color: true }
      });
      const set = new Set();
      distinctDetails.forEach(l => set.add(l.colorDetail));
      distinctEnums.forEach(l => set.add(COLOR_MAP[l.color] || l.color));
      values = Array.from(set).sort();
    }
    else if (key === 'pollutionNorm' || key === 'norma de poluare') {
      const distinctListings = await prisma.listing.findMany({
        where: { pollutionNorm: { not: null } },
        distinct: ["pollutionNorm"],
        select: { pollutionNorm: true }
      });
      values = distinctListings.map(l => POLLUTION_NORM_MAP[l.pollutionNorm] || l.pollutionNorm);
    }
    else {
      values = [];
    }

    res.status(200).json(values);
  } catch (error) {
    console.error("Error in getUniqueAttributeValues:", error);
    res.status(500).json({ message: "Eroare la preluarea valorilor unice." });
  }
};

const getAttributeStats = async (req, res) => {
  try {
    const { attributeId } = req.params;
    let key = attributeId;
    if (attributeId.startsWith("attr:")) {
      key = attributeId.substring(5);
    } else {
      key = UUID_TO_KEY[attributeId] || attributeId;
    }

    let field = null;
    if (key === 'price' || key === 'pret' || key === 'Pret') field = 'price';
    else if (key === 'mileage' || key === 'kilometraj' || key === 'Kilometraj') field = 'mileage';
    else if (key === 'year' || key === 'an' || key === 'An') field = 'year';
    else if (key === 'powerHp' || key === 'putere' || key === 'Putere (CP)') field = 'powerHp';
    else if (key === 'engineCapacity' || key === 'capacitate' || key === 'Capacitate cilindrică') field = 'engineCapacity';

    if (!field) {
      return res.status(200).json({ min: 0, max: 100000 });
    }

    const stats = await prisma.listing.aggregate({
      where: {
        [field]: { not: null },
      },
      _min: { [field]: true },
      _max: { [field]: true },
    });

    res.status(200).json({
      min: stats._min[field] !== null ? stats._min[field] : 0,
      max: stats._max[field] !== null ? stats._max[field] : 100000,
    });
  } catch (error) {
    console.error("Error in getAttributeStats:", error);
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
    } else if (businessUserEmail === "contact@carsleasing.ro") {
      sendContactNotification({ toEmail: "office@davocars.ro", name, email, phone, message })
        .then(() => console.log("[Email] Notificare trimisă către Cars Leasing"))
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
        make: true,
        model: true,
        images: {
          orderBy: { order: "asc" },
        }
      },
    });

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
      text = text.replace(/\s+/g, " ");
      return text.trim();
    };

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
      
      const marca = listing.make?.name || listing.title.trim().split(/\s+/)[0] || "";
      const model = listing.model?.name || listing.title.trim().split(/\s+/)[1] || "";

      const an = listing.year ? listing.year.toString() : "";
      const kilometraj = listing.mileage ? listing.mileage.toString() : "";
      const combustibil = listing.fuelType ? (FUEL_TYPE_MAP[listing.fuelType] || listing.fuelType) : "";
      const cutie_viteze = listing.gearbox ? (GEARBOX_MAP[listing.gearbox] || listing.gearbox) : "";
      const capacitate_cilindrica = listing.engineCapacity ? listing.engineCapacity.toString() : "";
      const putere_cp = listing.powerHp ? listing.powerHp.toString() : "";

      let pret = "";
      if (listing.price) {
        pret = `${listing.price} EUR`;
      }

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

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=listings-feed.csv");

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
