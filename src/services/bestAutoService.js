const axios = require("axios");

// Cache pentru token-uri: { "API_KEY_CLIENT": { token: "...", expiresAt: 123456 } }
const tokenCache = new Map();

const BASE_URL = "https://services.bestauto.ro/api";

// 1. Obținerea Token-ului (gestionare automată expirare)
const getAccessToken = async (apiKey) => {
  const now = Date.now();
  const cached = tokenCache.get(apiKey);

  // Dacă avem token valid în cache, îl folosim
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }

  // Altfel, cerem unul nou
  try {
    console.log("[BestAuto] Generare token nou...");
    const response = await axios.post(
      `${BASE_URL}/Token?ApiKey=${apiKey}`,
      {},
      { headers: { "x-api-version": "1" } }
    );

    const token = response.data; // BestAuto returnează tokenul ca string direct (conform PDF)
    
    // Tokenul e valid 24h. Setăm expirarea la 23h pentru siguranță.
    const expiresAt = now + 23 * 60 * 60 * 1000;
    
    tokenCache.set(apiKey, { token, expiresAt });
    return token;
  } catch (error) {
    console.error("[BestAuto] Eroare la autentificare:", error.message);
    throw new Error("Nu s-a putut obține token-ul BestAuto.");
  }
};

// 2. Maparea datelor din DB-ul tău în formatul BestAuto
// ... restul codului ...

const mapListingToPayload = (listing, business) => {
  const now = new Date();
  const validFrom = now.toISOString().split('.')[0]; 
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const validTo = futureDate.toISOString().split('.')[0]; 

  const attributesMap = {
    "marca": "make",
    "model": "model",
    "an": "carregistrationdate",
    "combustibil": "carfueltype",
    "caroserie": "carbody",
    "putere": "carpower",
    "putere (cp)": "carpower",
    "capacitate cilindrica": "carcmc",
    "cutie de viteze": "gearbxtype",
    "transmisie": "gearbxtype"
  };

  const properties = [];

  if (listing.mileage) {
    properties.push({ key: "km", value: listing.mileage.toString() });
  }

  if (listing.attributeValues) {
    listing.attributeValues.forEach((av) => {
      const dbAttrName = av.attribute.name.toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 

      const bestAutoKey = Object.keys(attributesMap).find(key => 
        dbAttrName.includes(key)
      );

      if (bestAutoKey) {
        let val = "";
        if (av.stringValue) val = av.stringValue;
        else if (av.numberValue !== null) val = av.numberValue.toString();
        else if (av.booleanValue !== null) val = av.booleanValue ? "Da" : "Nu";

        if (val && val !== "null") {
           properties.push({
             key: attributesMap[bestAutoKey],
             value: val
           });
        }
      }
    });
  }

  // Make/Model fallback
  let makeValue = properties.find(p => p.key === 'make')?.value;
  let modelValue = properties.find(p => p.key === 'model')?.value;

  if (!makeValue) {
    let titleMake = listing.title.split(' ')[0] || "Altele";
    if (titleMake.toLowerCase() === "mercedes") titleMake = "Mercedes-Benz";
    properties.push({ key: 'make', value: titleMake });
  }
  if (!modelValue) {
    const titleModel = listing.title.split(' ')[1] || "Altele";
    properties.push({ key: 'model', value: titleModel });
  }

  // Descriere validă
  let description = listing.description || "";
  if (description.length < 20) {
    description += "\n Detalii complete disponibile la telefon.";
  }

  // Construim obiectul ad
  const adObject = {
      active: true,
      promoted: false,
      externalid: listing.id,
      category: 21,
      price: listing.price || 1,
      currency: "EUR",
      title: listing.title.substring(0, 100),
      text: description,
      validFrom: validFrom,
      validTo: validTo,
      
      contact: {
        contactName: business.name || "AWD Auto",
        contactEmail: "contact@awdauto.ro",
        contactPhone: "0752228593"
      },
      location: {
        countyName: "Cluj",
        cityName: "Cluj-Napoca"
      }
  };

  // Adăugăm properties doar dacă există
  if (properties.length > 0) {
    adObject.properties = properties;
  }

  // Adăugăm pictures doar dacă există
  if (listing.images && listing.images.length > 0) {
    adObject.pictures = listing.images.map((img, index) => ({
      url: img.url,
      rank: index + 1
    }));
  }

  return {
    user: {
      email: "contact@awdauto.ro"
    },
    ad: adObject
  };
};

// 3. Funcția principală de publicare/actualizare
const publishListing = async (listing, apiKey) => {
  try {
    const token = await getAccessToken(apiKey);
    const payload = mapListingToPayload(listing, listing.business);

    // --- DEBUGGING CRITIC ---
    console.log(`[BestAuto] Payload care va fi trimis:`, JSON.stringify(payload, null, 2));
    // ------------------------

    console.log(`[BestAuto] Trimitere anunț ${listing.id}...`);
    
    await axios.post(`${BASE_URL}/Article`, payload, {
      headers: {
        "x-api-version": "1",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    console.log(`[BestAuto] Anunț ${listing.id} sincronizat cu succes!`);
    return true;
  } catch (error) {
    // Logăm eroarea completă de la server
    console.error(`[BestAuto] Eroare la sincronizare anunț ${listing.id}:`, 
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    return false;
  }
};

// 4. Funcția de ștergere
const deleteListing = async (listingId, apiKey) => {
  try {
    const token = await getAccessToken(apiKey);
    const email = "contact@awdauto.ro"; // Trebuie să fie același cu cel folosit la creare

    console.log(`[BestAuto] Ștergere anunț ${listingId}...`);

    await axios.delete(`${BASE_URL}/Article?Email=${email}&ExternalId=${listingId}`, {
      headers: {
        "x-api-version": "1",
        "Authorization": `Bearer ${token}`
      }
    });

    console.log(`[BestAuto] Anunț ${listingId} șters cu succes!`);
  } catch (error) {
    console.error(`[BestAuto] Eroare la ștergere:`, error.message);
  }
};

module.exports = { publishListing, deleteListing };