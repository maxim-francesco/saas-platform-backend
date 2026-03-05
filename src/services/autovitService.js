// src/services/autovitService.js
const axios = require("axios");

const BASE_URL = "https://www.autovit.ro/api/open";

// Cache token per clientId
const tokenCache = new Map();

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

    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("username", username);
    params.append("password", password);

    console.log("[Autovit] Încerc autentificare cu:", {
      clientId,
      username,
      hasSecret: !!clientSecret,
      hasPassword: !!password,
    });

    const response = await axios.post(
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
    throw new Error("Nu s-a putut obține token-ul Autovit.");
  }
};

// ─────────────────────────────────────────────
// 2. CREARE COLECȚIE IMAGINI
// ─────────────────────────────────────────────
const createImageCollection = async (imageUrls, token, username) => {
  try {
    console.log(`[Autovit] Creare colecție cu ${imageUrls.length} imagini...`);

    const imagesPayload = {};
    imageUrls.forEach((url, index) => {
      imagesPayload[String(index + 1)] = url;
    });

    const response = await axios.post(
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

    console.log(`[Autovit] Colecție imagini creată cu ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error("[Autovit] Eroare creare colecție imagini:", error.response?.data || error.message);
    throw new Error("Nu s-a putut crea colecția de imagini pe Autovit.");
  }
};

// ─────────────────────────────────────────────
// 3. CREARE ANUNȚ
// ─────────────────────────────────────────────
const createAdvert = async (advertData, token, username) => {
  try {
    console.log("[Autovit] Creare anunț...");

    const response = await axios.post(
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

    console.log(`[Autovit] Anunț creat cu ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare creare anunț:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut crea anunțul pe Autovit."
    );
  }
};

// ─────────────────────────────────────────────
// 4. ACTUALIZARE ANUNȚ
// ─────────────────────────────────────────────
const updateAdvert = async (autovitId, advertData, token, username) => {
  try {
    console.log(`[Autovit] Actualizare anunț ${autovitId}...`);

    const response = await axios.put(
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

    console.log(`[Autovit] Anunț ${autovitId} actualizat.`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare actualizare anunț:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.error?.message || "Nu s-a putut actualiza anunțul pe Autovit."
    );
  }
};

// ─────────────────────────────────────────────
// 5. ȘTERGERE ANUNȚ
// ─────────────────────────────────────────────
const deleteAdvert = async (autovitId, token, username) => {
  try {
    console.log(`[Autovit] Ștergere anunț ${autovitId}...`);

    await axios.delete(`${BASE_URL}/account/adverts/${autovitId}`, {
      headers: {
        "User-Agent": username,
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`[Autovit] Anunț ${autovitId} șters.`);
    return true;
  } catch (error) {
    console.error("[Autovit] Eroare ștergere anunț:", error.response?.data || error.message);
    throw new Error("Nu s-a putut șterge anunțul de pe Autovit.");
  }
};

// ─────────────────────────────────────────────
// 6. ACTIVARE ANUNȚ
// ─────────────────────────────────────────────
const activateAdvert = async (autovitId, token, username) => {
  try {
    console.log(`[Autovit] Activare anunț ${autovitId}...`);

    const response = await axios.post(
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

    console.log(`[Autovit] Anunț ${autovitId} activat.`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare activare anunț:", error.response?.data || error.message);
    throw new Error("Nu s-a putut activa anunțul pe Autovit.");
  }
};

// ─────────────────────────────────────────────
// 7. DEZACTIVARE ANUNȚ
// ─────────────────────────────────────────────
const deactivateAdvert = async (autovitId, token, username) => {
  try {
    console.log(`[Autovit] Dezactivare anunț ${autovitId}...`);

    const response = await axios.post(
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

    console.log(`[Autovit] Anunț ${autovitId} dezactivat.`);
    return response.data;
  } catch (error) {
    console.error("[Autovit] Eroare dezactivare anunț:", error.response?.data || error.message);
    throw new Error("Nu s-a putut dezactiva anunțul pe Autovit.");
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
    "sedan": "sedan", "berlina": "sedan",
    "hatchback": "hatchback",
    "combi": "combi", "break": "combi",
    "suv": "suv",
    "coupe": "coupe",
    "cabrio": "cabrio", "cabriolet": "cabrio",
    "van": "van", "monovolum": "van",
    "pickup": "pickup",
    "minivan": "minivan",
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
  if (params.gearbox) {
    params.gearbox = gearboxMap[normalizeText(params.gearbox)] || "manual";
  }
  if (params.body_type) {
    params.body_type = bodyTypeMap[normalizeText(params.body_type)] || "sedan";
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
    description: listing.description || "Anunț publicat prin API.",
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