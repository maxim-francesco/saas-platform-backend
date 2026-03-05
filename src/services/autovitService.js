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
  const fuelTypeMap = {
    petrol: "petrol",
    gasoline: "petrol",
    diesel: "diesel",
    hybrid: "hybrid",
    electric: "electric",
    lpg: "lpg",
    cng: "cng",
  };

  const gearboxMap = {
    manual: "manual",
    automatic: "automatic",
    semi_automatic: "semi-automatic",
    semi: "semi-automatic",
  };

  const bodyTypeMap = {
    sedan: "sedan",
    hatchback: "hatchback",
    combi: "combi",
    suv: "suv",
    coupe: "coupe",
    cabrio: "cabrio",
    van: "van",
    pickup: "pickup",
    minivan: "minivan",
  };

  return {
    title: `${listing.make} ${listing.model} ${listing.year}`,
    description: listing.description || "Anunț publicat prin API.",
    category_id: 29,
    region_id: listing.autovitRegionId || 1,
    city_id: listing.autovitCityId || 1,
    advertiser_type: "business",
    image_collection_id: imageCollectionId,
    contact: {
      person: listing.contactPerson || "Dealer",
      phones: listing.contactPhone ? [listing.contactPhone] : [],
    },
    params: {
      make: (listing.make || "").toLowerCase().replace(/\s+/g, "-"),
      model: (listing.model || "").toLowerCase().replace(/\s+/g, "-"),
      year: listing.year,
      mileage: listing.mileage || 0,
      fuel_type: fuelTypeMap[listing.fuelType?.toLowerCase()] || "petrol",
      engine_power: String(listing.enginePower || ""),
      engine_capacity: String(listing.engineCapacity || ""),
      gearbox: gearboxMap[listing.gearbox?.toLowerCase()] || "manual",
      body_type: bodyTypeMap[listing.bodyType?.toLowerCase()] || "sedan",
      color: (listing.color || "white").toLowerCase(),
      price: {
        "0": "price",
        "1": listing.price || 0,
        currency: listing.currency || "RON",
        gross_net: "gross",
      },
      condition: listing.condition || "used",
      is_imported_car: listing.isImportedCar || false,
      first_registration_year: listing.firstRegistrationYear || listing.year,
    },
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