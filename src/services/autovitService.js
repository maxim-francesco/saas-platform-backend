// src/services/autovitService.js
const HttpsProxyAgent = require("https-proxy-agent");
const axios = require("axios");

const BASE_URL = "https://www.autovit.ro/api/open";

// Cache token per clientId
const tokenCache = new Map();

// Proxy cu IP static pentru Autovit
const getProxiedAxios = () => {
  const proxyUrl = process.env.AUTOVIT_PROXY_URL;
  if (!proxyUrl) {
    console.warn("[Autovit] ATENTIE: AUTOVIT_PROXY_URL nu e setat!");
    return axios;
  }
  const agent = new HttpsProxyAgent.HttpsProxyAgent(proxyUrl);
  return axios.create({
    httpsAgent: agent,
    proxy: false,
  });
};

// ─────────────────────────────────────────────
// 1. AUTENTIFICARE
// ─────────────────────────────────────────────
const getAccessToken = async (clientId, clientSecret, username, password) => {
  const now = Date.now();
  const cached = tokenCache.get(clientId);
  if (cached && cached.expiresAt > now) {
    console.log("[Autovit] Folosim token din cache.");
    return cached.token;
  }

  try {
    console.log("[Autovit] Generare token nou...");
    const client = getProxiedAxios(); // <-- ADAUGAT

    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("username", username);
    params.append("password", password);

    const response = await client.post( // <-- client in loc de axios
      `${BASE_URL}/oauth/token`,
      params.toString(),
      {
        auth: { username: clientId, password: clientSecret },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token } = response.data;
    tokenCache.set(clientId, {
      token: access_token,
      expiresAt: now + 11 * 60 * 60 * 1000,
    });

    console.log("[Autovit] Token generat cu succes.");
    return access_token;
  } catch (error) {
    console.error("[Autovit] Eroare autentificare:", error.response?.data || error.message);
    throw new Error("Nu s-a putut obtine token-ul Autovit.");
  }
};

// ─────────────────────────────────────────────
// 2. CREARE COLECȚIE IMAGINI
// ─────────────────────────────────────────────
const createImageCollection = async (imageUrls, token, username) => {
  try {
    console.log(`[Autovit] Creare colectie cu ${imageUrls.length} imagini...`);
    const client = getProxiedAxios(); // <-- ADAUGAT

    const imagesPayload = {};
    imageUrls.forEach((url, index) => {
      imagesPayload[String(index + 1)] = url;
    });

    const response = await client.post( // <-- client
      `${BASE_URL}/imageCollections`,
      imagesPayload,
      {
        headers: {
          "User-Agent": username,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Bulk-Error": "per_item",
        },
      }
    );

    console.log(`[Autovit] Colectie imagini creata cu ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error("[Autovit] Eroare creare colectie imagini:", error.response?.data || error.message);
    throw new Error("Nu s-a putut crea colectia de imagini pe Autovit.");
  }
};

// ─────────────────────────────────────────────
// 3. CREARE ANUNȚ
// ─────────────────────────────────────────────
const createAdvert = async (advertData, token, username) => {
  try {
    console.log("[Autovit] Creare anunt...");
    console.log("[Autovit] PAYLOAD TRIMIS:", JSON.stringify(advertData.params, null, 2)); // <-- ADAUGĂ

    const client = getProxiedAxios(); // <-- ADAUGAT

    const response = await client.post( // <-- client
      `${BASE_URL}/account/adverts`,
      advertData,
      {
        headers: {
          "User-Agent": username,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`[Autovit] Anunt creat cu ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare creare anunt:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut crea anuntul pe Autovit."
    );
  }
};

// ─────────────────────────────────────────────
// 4. ACTUALIZARE ANUNȚ
// ─────────────────────────────────────────────
const updateAdvert = async (autovitId, advertData, token, username) => {
  try {
    console.log(`[Autovit] Actualizare anunt ${autovitId}...`);
    const client = getProxiedAxios(); // <-- ADAUGAT

    const response = await client.put( // <-- client
      `${BASE_URL}/account/adverts/${autovitId}`,
      advertData,
      {
        headers: {
          "User-Agent": username,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`[Autovit] Anunt ${autovitId} actualizat.`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare actualizare anunt:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut actualiza anuntul pe Autovit."
    );
  }
};

// ─────────────────────────────────────────────
// 5. ȘTERGERE ANUNȚ
// ─────────────────────────────────────────────
const deleteAdvert = async (autovitId, token, username) => {
  try {
    console.log(`[Autovit] Stergere anunt ${autovitId}...`);
    const client = getProxiedAxios(); // <-- ADAUGAT

    await client.delete( // <-- client
      `${BASE_URL}/account/adverts/${autovitId}`,
      {
        headers: {
          "User-Agent": username,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`[Autovit] Anunt ${autovitId} sters.`);
    return true;
  } catch (error) {
    console.error("[Autovit] Eroare stergere anunt:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut sterge anuntul de pe Autovit."
    );
  }
};

const activateAdvert = async (autovitId, token, username) => {
  try {
    const client = getProxiedAxios(); // <-- ADAUGAT
    const response = await client.post( // <-- client
      `${BASE_URL}/account/adverts/${autovitId}/activate`,
      {},
      {
        headers: {
          "User-Agent": username,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut activa anuntul pe Autovit."
    );
  }
};

const deactivateAdvert = async (autovitId, token, username) => {
  try {
    const client = getProxiedAxios(); // <-- ADAUGAT
    const response = await client.post( // <-- client
      `${BASE_URL}/account/adverts/${autovitId}/deactivate`,
      {
        reason: {
          id: "1",
          description: "Dezactivat prin API",
        },
      },
      {
        headers: {
          "User-Agent": username,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut dezactiva anuntul pe Autovit."
    );
  }
};

const exportToOLX = async (autovitId, token, username) => {
  try {
    console.log(`[Autovit] Export OLX pentru anunț ${autovitId}...`);
    const client = getProxiedAxios();

    const response = await client.post(
      `${BASE_URL}/account/adverts/${autovitId}/promotions/`,
      {
        payment_type: "account",
        promotion_ids: [49],
      },
      {
        headers: {
          "User-Agent": username,
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`[Autovit] Anunț ${autovitId} exportat pe OLX.`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare export OLX:", error.response?.data || error.message);
    throw new Error("Nu s-a putut exporta anunțul pe OLX.");
  }
};

// ─────────────────────────────────────────────
// 8. MAPPING CÂMPURI PRISMA → AUTOVIT
// ─────────────────────────────────────────────
const mapListingToAutovit = (listing, imageCollectionId) => {
  const normalizeText = (str) =>
    str.toString().toLowerCase().trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

      const ATTRIBUTE_MAP = {
      "marca":                 "make",
      "model":                 "model",
      "an":                    "year",
      "kilometraj":            "mileage",
      "combustibil":           "fuel_type",
      "capacitate cilindrica": "engine_capacity",
      "putere":                "engine_power",
      "caroserie":             "body_type",
      "cutie de viteze":       "gearbox",
      "culoare":               "color",
      "norma de poluare":      "pollution_standard",
      "garantie luni":         "vendors_warranty_valid_until_date", // <-- ADAUGAT
    };

  const fuelTypeMap = {
    "benzina": "petrol", "petrol": "petrol", "gasoline": "petrol",
    "diesel": "diesel", "motorina": "diesel",
    "hybrid": "hybrid", "hibrid": "hybrid",
    "electric": "electric", "electrica": "electric",
    "lpg": "lpg", "gpl": "lpg",
    "benzina + gpl": "petrol-lpg",
    "cng": "cng",
    "benzina + cng": "petrol-cng",
    "hibrid plug-in": "plugin-hybrid",
  };

  const gearboxMap = {
    "manuala": "manual", "manual": "manual",
    "automata": "automatic", "automatic": "automatic",
    "semi-automata": "semi-automatic",
  };

  const bodyTypeMap = {
    "sedan": "sedan", "berlina": "sedan",
    "hatchback": "compact", "compacta": "compact", "compact": "compact",
    "combi": "combi", "break": "combi",
    "suv": "suv",
    "coupe": "coupe",
    "cabrio": "cabrio", "cabriolet": "cabrio",
    "van": "minivan", "monovolum": "minivan", "minivan": "minivan",
    "mini": "mini",
    "masina mica": "mini",
    "masina de oras": "city-car", "city-car": "city-car",
  };

  const colorMap = {
    "alb": "white", "white": "white",
    "negru": "black", "black": "black",
    "gri": "gray", "gray": "gray", "grey": "gray",
    "argint": "silver", "silver": "silver",
    "albastru": "blue", "blue": "blue",
    "rosu": "red", "red": "red",
    "verde": "green", "green": "green",
    "maro": "brown", "brown": "brown",
    "portocaliu": "orange", "orange": "orange",
    "galben": "yellow-gold", "auriu": "yellow-gold", "yellow": "yellow-gold",
    "bej": "bej", "beige": "bej",
    "alte culori": "other",
  };

  // ─────────────────────────────────────────────
  // MODEL MAP — traduce valorile din DB la slug-urile Autovit
  // Cheia = ce e stocat în DB (normalized)
  // Valoarea = slug-ul acceptat de Autovit
  // ─────────────────────────────────────────────
  const modelMap = {
    // BMW
    "seria 1": "seria-1", "seria1": "seria-1",
    "seria 2": "seria-2", "seria2": "seria-2",
    "seria 3": "seria-3", "seria3": "seria-3",
    "e46": "seria-3", "e90": "seria-3", "e36": "seria-3", "e30": "seria-3",
    "seria 4": "seria-4", "seria4": "seria-4",
    "seria 5": "seria-5", "seria5": "seria-5",
    "e60": "seria-5", "e39": "seria-5", "e34": "seria-5",
    "seria 6": "seria-6", "seria6": "seria-6",
    "seria 7": "seria-7", "seria7": "seria-7",
    "e65": "seria-7", "e38": "seria-7",
    "seria 8": "seria-8", "seria8": "seria-8",
    "x1": "x1", "x2": "x2", "x3": "x3", "x4": "x4",
    "x5": "x5", "x6": "x6", "x7": "x-7",
    "i3": "i3", "i4": "i4", "i5": "i5", "i7": "i7",
    "ix": "ix", "ix3": "ix3", "m3": "bmw-m3", "m4": "bmw-m4",
    "m5": "bmw-m5", "z3": "bmw-z3", "z4": "bmw-z4",

    // Mercedes
    "clasa a": "a", "clasa-a": "a",
    "clasa b": "b", "clasa-b": "b",
    "clasa c": "c", "clasa-c": "c",
    "clasa e": "e", "clasa-e": "e",
    "clasa s": "s", "clasa-s": "s",
    "clasa g": "g", "clasa-g": "g",
    "gla": "gla", "glb": "glb", "glc": "glc",
    "gle": "gle", "gls": "gls", "cla": "cla", "cls": "cls",
    "slk": "slk", "sl": "sl", "amg gt": "amg-gt",

    // Audi
    "a1": "a1", "a2": "a2", "a3": "a3", "a4": "a4",
    "a5": "a5", "a6": "a6", "a7": "a7", "a8": "a8",
    "q2": "q2", "q3": "q3", "q4": "q4", "q5": "q5",
    "q6": "q6", "q7": "q7", "q8": "q8",
    "tt": "tt", "r8": "r8", "e-tron": "e-tron",
    "rs3": "rs3", "rs4": "rs4", "rs5": "rs5", "rs6": "rs6", "rs7": "rs7",

    // Volkswagen
    "golf": "golf", "polo": "polo", "passat": "passat",
    "tiguan": "tiguan", "touareg": "touareg", "touran": "touran",
    "t-roc": "t-roc", "t-cross": "t-cross", "arteon": "arteon",
    "caddy": "caddy", "transporter": "transporter", "amarok": "amarok",
    "id.3": "id3", "id.4": "id-4", "id.5": "id5",

    // Skoda
    "octavia": "octavia", "fabia": "fabia", "superb": "superb",
    "karoq": "karoq", "kodiaq": "kodiaq", "kamiq": "kamiq",
    "scala": "scala", "enyaq": "enyaq",

    // Opel
    "astra": "astra", "corsa": "corsa", "insignia": "insignia",
    "mokka": "mokka", "grandland": "grandland", "crossland": "crossland-x",
    "zafira": "zafira", "vectra": "vectra", "omega": "omega",

    // Ford
    "focus": "focus", "fiesta": "fiesta", "mondeo": "mondeo",
    "kuga": "kuga", "puma": "puma", "edge": "edge",
    "mustang": "mustang", "ranger": "ranger", "transit": "transit",
    "ecosport": "ecosport", "galaxy": "galaxy", "s-max": "s-max",
    "c-max": "c-max", "b-max": "b-max",

    // Renault
    "clio": "clio", "megane": "megane", "laguna": "laguna",
    "scenic": "scenic", "captur": "captur", "kadjar": "kadjar",
    "koleos": "koleos", "duster": "duster", "logan": "logan",
    "sandero": "sandero", "talisman": "talisman", "zoe": "zoe",
    "austral": "austral", "arkana": "arkana",

    // Peugeot
    "206": "206", "207": "207", "208": "208",
    "306": "306", "307": "307", "308": "308",
    "406": "406", "407": "407", "408": "408",
    "2008": "2008", "3008": "3008", "4008": "4008", "5008": "5008",
    "508": "508",

    // Toyota
    "yaris": "yaris", "corolla": "corolla", "camry": "camry",
    "rav4": "rav-4", "rav 4": "rav-4", "land cruiser": "land-cruiser",
    "hilux": "hilux", "avensis": "avensis", "auris": "auris",
    "prius": "prius", "c-hr": "c-hr", "aygo": "aygo",

    // Hyundai
    "i10": "i10", "i20": "i20", "i30": "i30", "i40": "i40",
    "tucson": "tucson", "santa fe": "santa-fe", "kona": "kona",
    "ioniq": "ioniq", "ix35": "ix35", "ix20": "ix20",

    // Kia
    "picanto": "picanto", "rio": "rio", "ceed": "ceed",
    "sportage": "sportage", "sorento": "sorento", "stinger": "stinger",
    "niro": "niro", "ev6": "ev6",

    // Dacia
    "sandero": "sandero", "logan": "logan", "duster": "duster",
    "jogger": "jogger", "spring": "spring",

    // Honda
    "civic": "civic", "accord": "accord", "cr-v": "cr-v",
    "jazz": "jazz", "hr-v": "hr-v",

    // Mazda
    "mazda 3": "3", "mazda 6": "6", "cx-5": "cx-5",
    "cx-3": "cx-3", "cx-30": "cx-30", "mx-5": "mx-5",

    // Nissan
    "micra": "micra", "juke": "juke", "qashqai": "qashqai",
    "x-trail": "x-trail", "leaf": "leaf", "navara": "navara",

    // Seat
    "ibiza": "ibiza", "leon": "leon", "ateca": "ateca",
    "tarraco": "tarraco", "arona": "arona",

    // Citroen
    "c1": "c1", "c2": "c2", "c3": "c3", "c4": "c4",
    "c5": "c5", "berlingo": "berlingo", "jumper": "jumper",
    "c3 aircross": "c3-aircross", "c5 aircross": "c5-aircross",

    // Fiat
    "500": "500", "punto": "punto", "bravo": "bravo",
    "tipo": "tipo", "doblo": "doblo", "ducato": "ducato",
    "panda": "panda",

    // Volvo
    "s40": "s40", "s60": "s60", "s80": "s80", "s90": "s90",
    "v40": "v40", "v50": "v50", "v60": "v60", "v70": "v70", "v90": "v90",
    "xc40": "xc-40", "xc 40": "xc-40",
    "xc60": "xc-60", "xc 60": "xc-60",
    "xc90": "xc-90", "xc 90": "xc-90",

    // Jeep
    "renegade": "renegade", "compass": "compass",
    "cherokee": "cherokee", "grand cherokee": "grand-cherokee",
    "wrangler": "wrangler",

    // Mitsubishi
    "outlander": "outlander", "asx": "asx",
    "lancer": "lancer", "pajero": "pajero", "eclipse cross": "eclipse-cross",

    // Subaru
    "impreza": "impreza", "forester": "forester",
    "outback": "outback", "xv": "xv", "legacy": "legacy",

    // Suzuki
    "swift": "swift", "vitara": "vitara", "jimny": "jimny",
    "sx4": "sx4", "ignis": "ignis",

    // Alfa Romeo
    "giulia": "giulia", "stelvio": "stelvio", "giulietta": "giulietta",
    "147": "147", "156": "156", "159": "159",

    // Porsche
    "911": "911", "cayenne": "cayenne", "macan": "macan",
    "panamera": "panamera", "taycan": "taycan", "boxster": "boxster",
    "cayman": "cayman",

    // Land Rover
    "range rover": "range-rover", "discovery": "discovery",
    "freelander": "freelander", "defender": "defender",
    "range rover sport": "range-rover-sport",
    "range rover evoque": "range-rover-evoque",
    "range rover velar": "range-rover-velar",
    "discovery sport": "discovery-sport",

    // Jaguar
    "xe": "xe", "xf": "xf", "xj": "xj",
    "f-pace": "f-pace", "e-pace": "e-pace", "i-pace": "i-pace",
    "f-type": "f-type",

    // Lexus
    "is": "seria-is", "es": "seria-es", "gs": "seria-gs",
    "ls": "seria-ls", "rx": "seria-rx", "nx": "serianx",
    "ux": "lexus-ux", "lc": "lc-500",

    // Chevrolet
    "aveo": "aveo", "cruze": "cruze", "captiva": "captiva",
    "malibu": "malibu", "orlando": "orlando", "trax": "trax",
    "spark": "spark",

    // Chrysler
    "300c": "300c", "300m": "300m", "voyager": "voyager",
    "grand voyager": "grand-voyager", "pt cruiser": "pt-cruiser",

    // Dodge
    "durango": "durango", "journey": "journey",
    "challenger": "challenger", "charger": "charger",

    // Lancia
    "delta": "delta", "ypsilon": "ypsilon",

    // Mini
    "cooper": "cooper", "cooper s": "cooper-s",
    "countryman": "countryman", "clubman": "clubman",
    "paceman": "paceman",

    // Saab
    "9-3": "9-3", "9-5": "9-5",

    // Lada / Dacia vechi
    "1300": "1300", "1310": "1310",
  };

  // Extragere atribute din DB
  const params = {};
  if (listing.attributeValues && Array.isArray(listing.attributeValues)) {
    for (const av of listing.attributeValues) {
      const normalizedName = normalizeText(av.attribute.name);
      const autovitKey = ATTRIBUTE_MAP[normalizedName];
      if (!autovitKey) continue;

      let value = av.stringValue ?? av.numberValue ?? av.booleanValue;
      if (value === null || value === undefined) continue;

      params[autovitKey] = value;
    }
  }

  // Normalizări
  if (params.fuel_type) {
    params.fuel_type = fuelTypeMap[normalizeText(params.fuel_type)] || normalizeText(params.fuel_type);
  }

  if (params.color) {
    params.color = colorMap[normalizeText(params.color)] || normalizeText(params.color);
  } else {
    params.color = "other";
    console.warn("[Autovit] color lipseste, folosim fallback: other");
  }

  if (params.gearbox) {
    params.gearbox = gearboxMap[normalizeText(params.gearbox)] || "manual";
  }

  if (params.body_type) {
    params.body_type = bodyTypeMap[normalizeText(params.body_type)] || normalizeText(params.body_type);
  } else {
    params.body_type = "sedan";
    console.warn("[Autovit] body_type lipseste, folosim fallback: sedan");
  }

  if (params.make) {
    params.make = normalizeText(params.make).replace(/\s+/g, "-");
  }

  // ─── MODEL: traducere DB → slug Autovit ───
  if (params.model) {
    const normalizedModel = normalizeText(params.model);
    const mappedModel = modelMap[normalizedModel];

    if (mappedModel) {
      params.model = mappedModel;
      console.log(`[Autovit] Model mapat: "${normalizedModel}" → "${mappedModel}"`);
    } else {
      // Fallback: trimitem ca atare cu slugify
      params.model = normalizedModel.replace(/\s+/g, "-");
      console.warn(`[Autovit] Model nemapat: "${normalizedModel}" — trimis ca slug: "${params.model}"`);
    }
  }

  if (params.engine_power) {
    params.engine_power = String(Math.round(params.engine_power));
  }

  if (params.engine_capacity) {
    params.engine_capacity = String(Math.round(params.engine_capacity));
  }

  if (params.year) {
    params.year = Math.round(params.year);
  }

  if (params.mileage) {
    params.mileage = Math.round(params.mileage);
  }

  // FORCE fallback body_type si color (asigurare dublă)
  if (!params.body_type) {
    params.body_type = "sedan";
  }
  if (!params.color) {
    params.color = "other";
  }

  params.price = {
    "0": "price",
    "1": listing.price || 0,
    currency: "EUR",
    gross_net: "gross",
  };

  // Câmpuri fixe
  params.condition = "used";
  params.is_imported_car = false;
  if (params.year) {
    params.first_registration_year = params.year;
  }

  const normalizedTitle = listing.title
  .split(' ')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(' ');

console.log("[Autovit] TITLU NORMALIZAT:", normalizedTitle);

return {
  title: normalizedTitle,
  description: listing.description && listing.description.trim().length >= 30
    ? listing.description
    : (listing.description || "") + " Detalii suplimentare disponibile la telefon.",
  category_id: 29,
  region_id: 1,
  city_id: 1,
  advertiser_type: "business",
  image_collection_id: imageCollectionId,
  contact: {
    person: "Dealer",
    phones: [],
  },
  params,
};
};

module.exports = {
  getAccessToken,
  createImageCollection,
  createAdvert,
  updateAdvert,
  deleteAdvert,
  activateAdvert,
  deactivateAdvert,
  exportToOLX, // <-- ADAUGAT
  mapListingToAutovit,
};