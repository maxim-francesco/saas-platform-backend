const axios = require("axios");

// ─────────────────────────────────────────────
// TOKEN CACHE
// ─────────────────────────────────────────────
// Structura: { "API_KEY": { token: "...", expiresAt: <timestamp ms> } }
const tokenCache = new Map();

const BASE_URL = "https://services.bestauto.ro/api";

// ─────────────────────────────────────────────
// CONSTANTE AWD AUTO
// ─────────────────────────────────────────────
const AWD_EMAIL = "contact@awdauto.ro";
const AWD_CONTACT_NAME = "AWD Auto";
const AWD_CONTACT_PHONE = "0752228593";
const AWD_COUNTY = "Cluj";
const AWD_CITY = "Cluj-Napoca";
const BESTAUTO_CATEGORY_ID = 21; // Mașini second hand

// ─────────────────────────────────────────────
// MAPARE ATRIBUTE DB → BESTAUTO
// Cheia = numele atributului din DB-ul AWD Auto (lowercase, fără diacritice)
// Valoarea = cheia acceptată de BestAuto API
// ─────────────────────────────────────────────
const ATTRIBUTE_MAP = {
  // Atribute numerice
  "an":                    "carregistrationdate",
  "capacitate cilindrica": "carcmc",
  "putere (cp)":           "carpower",

  // Atribute string
  "combustibil":           "carfueltype",
  "caroserie":             "carbody",
  "cutie de viteze":       "gearbxtype",
  "culoare":               "color",
  "norma de poluare":      "carpollutionnorm",

  // Tractiune — BestAuto key conform Swagger
  "tractiune":             "cartraction",

  // Atribute boolean — trimise ca string "Da"/"Nu"
  "scaune incalzite":      "heatedseats",
  "tva deductibil":        "vatdeductible",
};

// ─────────────────────────────────────────────
// NORMALIZARE TEXT
// Elimina diacritice si transforma in lowercase
// pentru comparatii robuste
// ─────────────────────────────────────────────
const normalizeText = (str) =>
  str
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // elimina diacritice

// ─────────────────────────────────────────────
// CORECȚII MĂRCI AUTO
// Unele mărci sunt scrise diferit față de lista BestAuto
// ─────────────────────────────────────────────
const MAKE_CORRECTIONS = {
  "vw":            "Volkswagen",
  "volkswagen":    "Volkswagen",
  "mercedes":      "Mercedes-Benz",
  "mercedesbenz":  "Mercedes-Benz",
  "bmw":           "BMW",
  "audi":          "Audi",
  "skoda":         "Skoda",
  "opel":          "Opel",
  "ford":          "Ford",
  "renault":       "Renault",
  "peugeot":       "Peugeot",
  "citroen":       "Citroen",
  "toyota":        "Toyota",
  "hyundai":       "Hyundai",
  "kia":           "Kia",
  "seat":          "Seat",
  "dacia":         "Dacia",
  "nissan":        "Nissan",
  "honda":         "Honda",
  "mazda":         "Mazda",
  "volvo":         "Volvo",
  "fiat":          "Fiat",
  "jeep":          "Jeep",
  "land rover":    "Land Rover",
  "landrover":     "Land Rover",
  "range rover":   "Land Rover",
  "mitsubishi":    "Mitsubishi",
  "subaru":        "Subaru",
  "suzuki":        "Suzuki",
  "alfa romeo":    "Alfa Romeo",
  "alfaromeo":     "Alfa Romeo",
  "porsche":       "Porsche",
  "lexus":         "Lexus",
  "infiniti":      "Infiniti",
  "jaguar":        "Jaguar",
  "mini":          "Mini",
  "chrysler":      "Chrysler",
  "dodge":         "Dodge",
  "chevrolet":     "Chevrolet",
  "tesla":         "Tesla",
};

// Corectează marca extrasă din titlu
const correctMake = (rawMake) => {
  const normalized = normalizeText(rawMake);
  return MAKE_CORRECTIONS[normalized] || rawMake;
};

// ─────────────────────────────────────────────
// 1. OBȚINERE TOKEN (cu cache + retry automat)
// ─────────────────────────────────────────────
const getAccessToken = async (apiKey) => {
  const now = Date.now();
  const cached = tokenCache.get(apiKey);

  // Folosim token-ul din cache dacă nu a expirat (marja de siguranță: 23h din 24h)
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  try {
    console.log("[BestAuto] Generare token nou...");
    const response = await axios.post(
      `${BASE_URL}/Token?ApiKey=${apiKey}`,
      {},
      { headers: { "x-api-version": "1" } }
    );

    const token = response.data; // BestAuto returnează tokenul ca string direct
    const expiresAt = now + 23 * 60 * 60 * 1000; // 23 ore

    tokenCache.set(apiKey, { token, expiresAt });
    console.log("[BestAuto] Token generat cu succes.");
    return token;
  } catch (error) {
    console.error(
      "[BestAuto] Eroare la autentificare:",
      error.response?.data || error.message
    );
    throw new Error("Nu s-a putut obține token-ul BestAuto.");
  }
};

// ─────────────────────────────────────────────
// 2. MAPARE LISTING → PAYLOAD BESTAUTO
// ─────────────────────────────────────────────
const mapListingToPayload = (listing) => {
  // --- Date de valabilitate anunț ---
  const now = new Date();
  const validFrom = now.toISOString();
  const validTo = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000 // +30 zile
  ).toISOString();

  // --- Extragere Marcă și Model din titlu ---
  // Convenție AWD Auto: "Marca Model restul_titlului" (ex: "Audi A6 2.0 TDI 190cp")
  const titleWords = listing.title.trim().split(/\s+/);
  const rawMake = titleWords[0] || "Altele";
  const rawModel = titleWords[1] || "Altele";

  const make = correctMake(rawMake);
  const model = rawModel;

  // --- Procesare atribute dinamice ---
  const properties = [];

  // Marcă și Model — întotdeauna prezente
  properties.push({ key: "make",  value: make  });
  properties.push({ key: "model", value: model });

  // Starea mașinii — toate mașinile AWD Auto sunt înmatriculate
  properties.push({ key: "carstatename", value: "inmatriculata" });

  // Kilometraj — stocat direct pe listing, nu ca atribut
  if (listing.mileage != null) {
    properties.push({ key: "km", value: listing.mileage.toString() });
  }

  // Atribute dinamice din DB
  if (listing.attributeValues && Array.isArray(listing.attributeValues)) {
    for (const av of listing.attributeValues) {
      // Normalizăm numele atributului din DB pentru comparație
      const normalizedAttrName = normalizeText(av.attribute.name);

      // Căutăm un match EXACT în ATTRIBUTE_MAP (nu mai folosim .includes())
      const bestAutoKey = ATTRIBUTE_MAP[normalizedAttrName];

      // Dacă nu avem un mapping definit, sărim atributul
      // (ex: "Pret", "Kilometraj", "Link Video" — gestionate separat sau ignorate)
      if (!bestAutoKey) continue;

      // Construim valoarea în funcție de tipul atributului
      let value = null;

      if (av.stringValue != null && av.stringValue !== "") {
        value = av.stringValue;
      } else if (av.numberValue != null) {
        value = av.numberValue.toString();
      } else if (av.booleanValue != null) {
        // BestAuto nu are documentat formatul boolean explicit,
        // trimitem ca "Da"/"Nu" (standard românesc)
        value = av.booleanValue ? "Da" : "Nu";
      }

      // Adăugăm doar dacă avem o valoare validă
      if (value !== null) {
        properties.push({ key: bestAutoKey, value });
      }
    }
  }

  // --- Descriere (minim 20 caractere cerut de BestAuto) ---
  let description = listing.description || "";
  if (description.trim().length < 20) {
    description =
      description.trim() +
      (description.trim().length > 0 ? " " : "") +
      "Detalii complete disponibile la telefon sau la sediul nostru.";
  }

  // --- Imagini ---
  // rank pornește de la 1 conform documentației BestAuto (exemplul din PDF folosește rank: 1, 2)
  const pictures = (listing.images || []).map((img, index) => ({
    url: img.url,
    rank: index + 1,
  }));

  // --- Payload final conform structurii din documentația BestAuto ---
  return {
    user: {
      email: AWD_EMAIL,
    },
    ad: {
      active: true,
      promoted: false,
      externalid: listing.id,
      category: BESTAUTO_CATEGORY_ID,
      price: listing.price || 0,
      currency: "EUR",
      title: listing.title.substring(0, 100), // limită BestAuto
      text: description,
      validFrom,
      validTo,
    },
    contact: {
      contactName:  AWD_CONTACT_NAME,
      contactEmail: AWD_EMAIL,
      contactPhone: AWD_CONTACT_PHONE,
    },
    location: {
      countyName: AWD_COUNTY,
      cityName:   AWD_CITY,
    },
    properties,
    pictures,
  };
};

// ─────────────────────────────────────────────
// 3. PUBLICARE / ACTUALIZARE ANUNȚ
// Același endpoint POST /Article pentru insert și update (conform doc.)
// ─────────────────────────────────────────────
const publishListing = async (listing, apiKey) => {
  try {
    const token = await getAccessToken(apiKey);
    const payload = mapListingToPayload(listing);

    console.log(
      `[BestAuto] Trimitere anunț ${listing.id} ("${listing.title}")...`
    );
    console.log(
      "[BestAuto] Payload:",
      JSON.stringify(payload, null, 2)
    );

    const response = await axios.post(`${BASE_URL}/Article`, payload, {
      headers: {
        "x-api-version":  "1",
        Authorization:    `Bearer ${token}`,
        "Content-Type":   "application/json",
      },
    });

    console.log(
      `[BestAuto] Anunț ${listing.id} sincronizat cu succes! Status: ${response.status}`
    );
    return true;
  } catch (error) {
    const status = error.response?.status;
    const data   = error.response?.data;

    // Dacă token-ul a expirat înainte de 23h, invalidăm cache-ul și reîncercăm o dată
    if (status === 401 || status === 402) {
      console.warn(
        `[BestAuto] Token invalid/expirat (${status}). Se invalidează cache-ul și se reîncearcă...`
      );
      tokenCache.delete(apiKey);

      try {
        const freshToken = await getAccessToken(apiKey);
        const payload = mapListingToPayload(listing);

        await axios.post(`${BASE_URL}/Article`, payload, {
          headers: {
            "x-api-version":  "1",
            Authorization:    `Bearer ${freshToken}`,
            "Content-Type":   "application/json",
          },
        });

        console.log(`[BestAuto] Retry reușit pentru anunțul ${listing.id}!`);
        return true;
      } catch (retryError) {
        console.error(
          `[BestAuto] Retry eșuat pentru anunțul ${listing.id}:`,
          retryError.response?.data || retryError.message
        );
        return false;
      }
    }

    console.error(
      `[BestAuto] Eroare la sincronizare anunț ${listing.id}: Status ${status}`,
      JSON.stringify(data || error.message, null, 2)
    );
    return false;
  }
};

// ─────────────────────────────────────────────
// 4. ȘTERGERE ANUNȚ
// ─────────────────────────────────────────────
const deleteListing = async (listingId, apiKey) => {
  try {
    const token = await getAccessToken(apiKey);

    console.log(`[BestAuto] Ștergere anunț ${listingId}...`);

    await axios.delete(
      `${BASE_URL}/Article?Email=${AWD_EMAIL}&ExternalId=${listingId}`,
      {
        headers: {
          "x-api-version": "1",
          Authorization:   `Bearer ${token}`,
        },
      }
    );

    console.log(`[BestAuto] Anunț ${listingId} șters cu succes!`);
    return true;
  } catch (error) {
    const status = error.response?.status;

    // Retry automat dacă token-ul a expirat
    if (status === 401 || status === 402) {
      console.warn(
        `[BestAuto] Token expirat la delete (${status}). Se reîncearcă...`
      );
      tokenCache.delete(apiKey);

      try {
        const freshToken = await getAccessToken(apiKey);

        await axios.delete(
          `${BASE_URL}/Article?Email=${AWD_EMAIL}&ExternalId=${listingId}`,
          {
            headers: {
              "x-api-version": "1",
              Authorization:   `Bearer ${freshToken}`,
            },
          }
        );

        console.log(`[BestAuto] Retry delete reușit pentru ${listingId}!`);
        return true;
      } catch (retryError) {
        console.error(
          `[BestAuto] Retry delete eșuat pentru ${listingId}:`,
          retryError.response?.data || retryError.message
        );
        return false;
      }
    }

    console.error(
      `[BestAuto] Eroare la ștergere anunț ${listingId}: Status ${status}`,
      error.response?.data || error.message
    );
    return false;
  }
};

module.exports = { publishListing, deleteListing };