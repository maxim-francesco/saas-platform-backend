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
    throw new Error("Nu s-a putut sterge anuntul de pe Autovit.");
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
    throw new Error("Nu s-a putut activa anuntul pe Autovit.");
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
    throw new Error("Nu s-a putut dezactiva anuntul pe Autovit.");
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

  // Mapping nume atribut DB → cheie Autovit
  const ATTRIBUTE_MAP = {
    "marca":                "make",
    "model":                "model",
    "an":                   "year",
    "kilometraj":           "mileage",
    "combustibil":          "fuel_type",
    "capacitate cilindrica":"engine_capacity",
    "putere":               "engine_power",
    "caroserie":            "body_type",
    "cutie de viteze":      "gearbox",
    "culoare":              "color",
  };

  const fuelTypeMap = {
    "benzina": "petrol", "petrol": "petrol", "gasoline": "petrol",
    "diesel": "diesel", "motorina": "diesel",
    "hybrid": "hybrid", "hibrid": "hybrid",
    "electric": "electric", "electrica": "electric",
    "lpg": "lpg", "gpl": "lpg",
    "cng": "cng",
  };

  const gearboxMap = {
    "manuala": "manual", "manual": "manual",
    "automata": "automatic", "automatic": "automatic",
    "semi-automata": "semi-automatic", "semi_automatic": "semi-automatic",
  };

    const bodyTypeMap = {
    "sedan": "sedan",
    "berlina": "sedan",
    "hatchback": "compact",      // Autovit nu are hatchback, cel mai apropiat e compact
    "combi": "combi",
    "break": "combi",
    "suv": "suv",
    "coupe": "coupe",
    "cabrio": "cabrio",
    "cabriolet": "cabrio",
    "van": "minivan",
    "monovolum": "minivan",
    "minivan": "minivan",
    "pickup": "suv",             // Nu există pickup, fallback suv
    "mini": "mini",
    "city-car": "city-car",
    "compact": "compact",
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
  "galben": "yellow-gold", "yellow": "yellow-gold", "auriu": "yellow-gold",
  "bej": "bej", "beige": "bej",
};

  // Extragem valorile din attributeValues
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

  // Normalizăm valorile specifice
  if (params.fuel_type) {
    params.fuel_type = fuelTypeMap[normalizeText(params.fuel_type)] || normalizeText(params.fuel_type);
  }

  if (params.color) {
    params.color = colorMap[normalizeText(params.color)] || "other";
  }

  if (params.gearbox) {
    params.gearbox = gearboxMap[normalizeText(params.gearbox)] || "manual";
  }
  if (params.body_type) {
    params.body_type = bodyTypeMap[normalizeText(params.body_type)] || "compact";
  }
  if (params.make) {
    params.make = normalizeText(params.make).replace(/\s+/g, "-");
  }
  if (params.model) {
    params.model = normalizeText(params.model).replace(/\s+/g, "-");
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

  // Prețul
  params.price = {
    "0": "price",
    "1": listing.price || 0,
    currency: "RON",
    gross_net: "gross",
  };

  // Câmpuri obligatorii cu fallback
  params.condition = "used";
  params.is_imported_car = false;
  if (params.year) {
    params.first_registration_year = params.year;
  }

  return {
    title: listing.title,
    // În return-ul final:
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
  mapListingToAutovit,
};