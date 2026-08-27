// src/controllers/publicController.js
const prisma = require("../config/prismaClient");
const { generateText } = require("../services/geminiService");
const { sendContactNotification } = require("../services/emailService");
const { toLegacyListing } = require("../utils/compatSerializer");
const { buildListingPublicUrl } = require("../utils/urlHelper");
const { normalizeRoPhone } = require("../utils/phone");

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

// #7: apel Gemini cu timeout local (geminiService nu are timeout propriu)
function generateTextWithTimeout(opts, timeoutMs = 15000) {
  return Promise.race([
    generateText(opts),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), timeoutMs)),
  ]);
}

// #7: clasificare + asociere async, fire-and-forget
async function classifyContactMessageAsync({ messageId, businessId, messageText, hasContextListing }) {
  console.log(`[#7 classify] START classify for messageId=${messageId}, businessId=${businessId}, hasContextListing=${hasContextListing}`);
  try {
    const trimmed = (messageText || "").trim();
    if (trimmed.length < 15) {
      console.log(`[#7 classify] SKIP: message too short (${trimmed.length} characters)`);
      return;
    }

    console.log(`[#7 classify] Fetching AVAILABLE stock for business ${businessId}...`);
    const listings = await prisma.listing.findMany({
      where: { businessId, status: "AVAILABLE" },
      include: { make: true, model: true }
    });

    const stockList = listings
      .filter(l => l.make?.name && l.model?.name)
      .map(l => {
        const year = l.year ? String(l.year) : "";
        return `${l.make.name} ${l.model.name}${year ? " " + year : ""}`.trim();
      });

    console.log(`[#7 classify] Stock whitelist: [${stockList.join(", ")}]`);

    const systemInstruction = `Ești un lead classifier pentru un dealer de mașini rulate.
Primești mesajul primit de la un client și lista stocului disponibil al dealerului.
Trebuie să returnezi EXCLUSIV un obiect JSON de forma:
{
  "type": "GENERAL|STOCK|ORDER|BUYBACK|FINANCING",
  "make": "...",
  "model": "...",
  "year": ...
}

Reguli pentru tip ("type"):
- type TREBUIE să fie una dintre aceste 5 valori: GENERAL, STOCK, ORDER, BUYBACK, FINANCING.
- STOCK = întreabă despre o mașină din stocul de mai jos;
- ORDER = dorește să comande/importe o mașină specifică, nu neapărat în stoc;
- BUYBACK = dorește să își VÂNDĂ mașina proprie dealerului;
- FINANCING = clientul întreabă despre finanțare/rate/credit/leasing pentru o mașină;
- GENERAL = orice altceva (orar, contact general etc.).

Reguli pentru make/model/year:
- Completează-le DOAR dacă clientul numește clar o mașină; altfel folosește null.
- Nu inventa o mașină și nu ghici.
- Propune doar make/model care se potrivește plauzibil cu lista de stoc de mai jos.
- Nu folosi markdown, returnează doar JSON-ul simplu.`;

    const prompt = `Mesaj client: "${trimmed}"\nStoc disponibil: [${stockList.join(", ")}]`;

    console.log(`[#7 classify] Calling Gemini with prompt:\n${prompt}`);
    const rawRes = await generateTextWithTimeout({
      systemInstruction,
      prompt,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      temperature: 0
    });

    console.log(`[#7 classify] RAW Gemini response: "${rawRes}"`);

    let cleanRaw = rawRes.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```(json)?\n?/, "");
      cleanRaw = cleanRaw.replace(/\n?```$/, "");
      cleanRaw = cleanRaw.trim();
    }

    console.log(`[#7 classify] Cleaned JSON string: "${cleanRaw}"`);

    let parsed;
    try {
      parsed = JSON.parse(cleanRaw);
    } catch (parseErr) {
      console.error(`[#7 classify] JSON Parse Failed for: "${cleanRaw}"`, parseErr.message);
      return;
    }

    console.log(`[#7 classify] Parsed AI output:`, parsed);

    const allowedTypes = ["GENERAL", "STOCK", "ORDER", "BUYBACK", "FINANCING"];
    const proposedType = parsed.type;

    const currentMessage = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!currentMessage) {
      console.error(`[#7 classify] Message not found: ${messageId}`);
      return;
    }

    const currentType = currentMessage.type;
    const aiTypeAllowed = currentType === "GENERAL";   // only fill the unknown, never override a specific intent
    const newType = (aiTypeAllowed && proposedType && allowedTypes.includes(proposedType)) ? proposedType : currentType;
    const typeChanged = newType !== currentType;

    console.log(`[#7 classify] Message type: current=${currentType}, proposed=${proposedType}, final=${newType}, changed=${typeChanged}`);

    let matchedListingId = null;
    const proposedMake = parsed.make;
    const proposedModel = parsed.model;
    const proposedYear = parsed.year;

    if (!hasContextListing && proposedMake && proposedModel) {
      console.log(`[#7 classify] Checking deterministic association for: ${proposedMake} ${proposedModel} (${proposedYear || "no year"})`);
      const baseWhere = {
        businessId,
        status: "AVAILABLE",
        make: {
          name: {
            equals: proposedMake,
            mode: "insensitive"
          }
        },
        model: {
          name: {
            equals: proposedModel,
            mode: "insensitive"
          }
        }
      };

      const countWithoutYear = await prisma.listing.count({
        where: baseWhere
      });
      console.log(`[#7 classify] Count without year: ${countWithoutYear}`);

      if (!proposedYear && countWithoutYear > 1) {
        console.log(`[#7 classify] Ambiguous: No year proposed by AI, and multiple listings (${countWithoutYear}) found without year filter.`);
      } else {
        const queryWhere = {
          ...baseWhere,
          ...(proposedYear ? { year: Number(proposedYear) } : {})
        };

        const countWithQuery = await prisma.listing.count({
          where: queryWhere
        });
        console.log(`[#7 classify] Count with exact query: ${countWithQuery}`);

        if (countWithQuery === 1) {
          const match = await prisma.listing.findFirst({
            where: queryWhere
          });
          if (match) {
            matchedListingId = match.id;
            console.log(`[#7 classify] Confident match found! listingId=${matchedListingId}`);
          }
        } else {
          console.log(`[#7 classify] Match not unique or zero. Count: ${countWithQuery}`);
        }
      }
    } else {
      console.log(`[#7 classify] Association skipped: hasContextListing=${hasContextListing}, proposedMake=${proposedMake}, proposedModel=${proposedModel}`);
    }

    if (typeChanged || matchedListingId) {
      const updateData = {};
      if (typeChanged) updateData.type = newType;
      if (matchedListingId) updateData.listingId = matchedListingId;

      console.log(`[#7 classify] Updating message ${messageId} in transaction...`);
      await prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id: messageId },
          data: updateData
        });

        if (typeChanged) {
          await tx.messageActivity.create({
            data: {
              messageId,
              kind: "TYPE_CHANGED",
              fromValue: currentType,
              toValue: newType,
              authorId: null
            }
          });
        }

        if (matchedListingId) {
          await tx.messageActivity.create({
            data: {
              messageId,
              kind: "LINKED_LISTING",
              toValue: matchedListingId,
              authorId: null
            }
          });
        }
      });
      console.log(`[#7 classify] Transaction committed successfully.`);
    } else {
      console.log(`[#7 classify] No DB update required.`);
    }

  } catch (err) {
    console.error("[#7 classify] esuat:", err.message);
  }
}

const submitContactForm = async (req, res) => {
  const { businessId, name, email, phone, message, type, listingId } = req.body;

  if (!businessId || !name || !email || !message) {
    return res.status(400).json({ message: "Toate câmpurile obligatorii trebuie completate." });
  }

  if (listingId) {
    try {
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, businessId: businessId }
      });
      if (!listing) {
        return res.status(400).json({ message: "Anunțul specificat nu există sau nu aparține acestui business." });
      }
    } catch (error) {
      console.error("Eroare la verificarea anunțului în contact:", error);
      return res.status(500).json({ message: "Eroare la verificarea anunțului." });
    }
  }

  try {
    const newMessage = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          name,
          email,
          phone: normalizeRoPhone(phone),
          message,
          businessId,
          type: type || "GENERAL",
          listingId: listingId || null
        }
      });

      await tx.messageActivity.create({
        data: {
          messageId: msg.id,
          kind: "CREATED",
          authorId: null
        }
      });

      return msg;
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

    // #7: clasificare + asociere async, fire-and-forget (nu blocheaza raspunsul clientului)
    classifyContactMessageAsync({
      messageId: newMessage.id,
      businessId,
      messageText: message,
      hasContextListing: !!listingId,
    }).catch((err) => console.error("[#7 classify] unhandled:", err.message));
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({ message: "Afacerea specificată nu a fost găsită." });
    }
    console.error("Eroare la trimiterea mesajului:", error);
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

      let link = buildListingPublicUrl(business, listing);

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

const getListingsXmlFeed = async (req, res) => {
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
      select: {
        id: true,
        title: true,
        description: true,
        slug: true,
        price: true,
        year: true,
        vin: true,
        mileage: true,
        fuelType: true,
        gearbox: true,
        bodyType: true,
        color: true,
        doors: true,
        seats: true,
        powerHp: true,
        co2Emissions: true,
        engineCapacity: true,
        make: {
          select: {
            name: true,
          },
        },
        model: {
          select: {
            name: true,
          },
        },
        images: {
          select: {
            url: true,
          },
          orderBy: {
            order: "asc",
          },
        },
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

    const xmlEscape = (str) => {
      if (str === null || str === undefined) return "";
      return str
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';

    for (const listing of listings) {
      const id = listing.id;
      const title = listing.title || "";
      const description = stripHtml(listing.description);
      const permalink = buildListingPublicUrl(business, listing) || "";
      const price = listing.price !== null && listing.price !== undefined ? listing.price.toString() : "";
      const currency = "EUR";
      const make = listing.make?.name || listing.title.trim().split(/\s+/)[0] || "";
      const model = listing.model?.name || listing.title.trim().split(/\s+/)[1] || "";
      const bodyType = listing.bodyType ? (BODY_TYPE_MAP[listing.bodyType] || "") : "";
      const color = listing.color ? (COLOR_MAP[listing.color] || "") : "";
      const fuel = listing.fuelType ? (FUEL_TYPE_MAP[listing.fuelType] || "") : "";
      const mileage = listing.mileage !== null && listing.mileage !== undefined ? listing.mileage.toString() : "";
      const transmission = listing.gearbox ? (GEARBOX_MAP[listing.gearbox] || "") : "";
      const year = listing.year !== null && listing.year !== undefined ? listing.year.toString() : "";
      const vin = listing.vin || "";
      const imageUrl = listing.images ? listing.images.map((img) => img.url).filter(Boolean).join("|") : "";
      const doorsCount = listing.doors !== null && listing.doors !== undefined ? listing.doors.toString() : "";
      const seatsCount = listing.seats !== null && listing.seats !== undefined ? listing.seats.toString() : "";
      const power = listing.powerHp !== null && listing.powerHp !== undefined ? Math.round(listing.powerHp * 0.7355).toString() : "";
      const emissions = listing.co2Emissions !== null && listing.co2Emissions !== undefined ? listing.co2Emissions.toString() : "";
      const engineCapacity = listing.engineCapacity !== null && listing.engineCapacity !== undefined ? listing.engineCapacity.toString() : "";

      xml += `  <post>\n`;
      xml += `    <id>${xmlEscape(id)}</id>\n`;
      xml += `    <title>${xmlEscape(title)}</title>\n`;
      xml += `    <description>${xmlEscape(description)}</description>\n`;
      xml += `    <permalink>${xmlEscape(permalink)}</permalink>\n`;
      xml += `    <price>${xmlEscape(price)}</price>\n`;
      xml += `    <currency>${xmlEscape(currency)}</currency>\n`;
      xml += `    <make>${xmlEscape(make)}</make>\n`;
      xml += `    <model>${xmlEscape(model)}</model>\n`;
      xml += `    <body_type>${xmlEscape(bodyType)}</body_type>\n`;
      xml += `    <color>${xmlEscape(color)}</color>\n`;
      xml += `    <fuel>${xmlEscape(fuel)}</fuel>\n`;
      xml += `    <mileage>${xmlEscape(mileage)}</mileage>\n`;
      xml += `    <transmission>${xmlEscape(transmission)}</transmission>\n`;
      xml += `    <year>${xmlEscape(year)}</year>\n`;
      xml += `    <vin>${xmlEscape(vin)}</vin>\n`;
      xml += `    <ImageURL>${xmlEscape(imageUrl)}</ImageURL>\n`;
      xml += `    <doors_count>${xmlEscape(doorsCount)}</doors_count>\n`;
      xml += `    <seats_count>${xmlEscape(seatsCount)}</seats_count>\n`;
      xml += `    <power>${xmlEscape(power)}</power>\n`;
      xml += `    <emissions>${xmlEscape(emissions)}</emissions>\n`;
      xml += `    <engine_capacity>${xmlEscape(engineCapacity)}</engine_capacity>\n`;
      xml += `    <engline_capacity>${xmlEscape(engineCapacity)}</engline_capacity>\n`;
      xml += `  </post>\n`;
    }

    xml += `</data>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.send(xml);
  } catch (error) {
    console.error("Eroare la generarea feed-ului XML:", error);
    res.status(500).json({ message: "Eroare la generarea feed-ului XML." });
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
  getListingsXmlFeed,
};
