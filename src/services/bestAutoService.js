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
  // 1. Calculăm datele (fără milisecunde pentru siguranță)
  const now = new Date();
  const validFrom = now.toISOString().split('.')[0]; 
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const validTo = futureDate.toISOString().split('.')[0]; 

  // 2. Maparea numelor atributelor (interne -> externe)
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

  // 3. Adăugăm Kilometrajul (Dacă există)
  if (listing.mileage) {
    properties.push({ Key: "km", Value: listing.mileage.toString() });
  }

  // 4. Procesăm atributele dinamice
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
           // Atenție: Folosim "Key" și "Value" cu litere mari
           properties.push({
             Key: attributesMap[bestAutoKey],
             Value: val
           });
        }
      }
    });
  }

  // 5. Plasa de siguranță pentru Make/Model (Obligatorii)
  // Verificăm dacă există deja, folosind cheia cu literă mare 'Key'
  let makeValue = properties.find(p => p.Key === 'make')?.Value;
  let modelValue = properties.find(p => p.Key === 'model')?.Value;

  if (!makeValue) {
    let titleMake = listing.title.split(' ')[0] || "Altele";
    if (titleMake.toLowerCase() === "mercedes") titleMake = "Mercedes-Benz";
    properties.push({ Key: 'make', Value: titleMake });
  }
  if (!modelValue) {
    const titleModel = listing.title.split(' ')[1] || "Altele";
    properties.push({ Key: 'model', Value: titleModel });
  }

  // 6. Descriere validă (Minim 20 caractere)
  let description = listing.description || "";
  if (description.length < 20) {
    description += "\n Detalii complete disponibile la telefon pentru acest autoturism.";
  }

  // 7. Pregătim imaginile (PascalCase)
  const pictures = listing.images && listing.images.length > 0 
    ? listing.images.map((img, index) => ({
        Url: img.url,
        Rank: index + 1
      }))
    : [];

  // 8. Returnăm obiectul cu structura PascalCase
  return {
    "User": {
      "Email": "contact@awdauto.ro"
    },
    "Ad": {
      "Active": true,
      "Promoted": false,
      "ExternalId": listing.id,
      "Category": 21,
      "Price": listing.price || 1,
      "Currency": "EUR",
      "Title": listing.title.substring(0, 100),
      "Text": description,
      "ValidFrom": validFrom,
      "ValidTo": validTo,
      
      "Contact": {
        "ContactName": business.name || "AWD Auto",
        "ContactEmail": "contact@awdauto.ro",
        "ContactPhone": "0752228593"
      },
      "Location": {
        "CountyName": "Cluj",
        "CityName": "Cluj-Napoca"
      },
      "Properties": properties,
      "Pictures": pictures
    }
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