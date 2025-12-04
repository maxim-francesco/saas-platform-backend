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
const mapListingToPayload = (listing, business) => {
  // 1. Calculăm datele de valabilitate (OBLIGATORII pentru BestAuto)
  const now = new Date();
  const validFrom = now.toISOString(); 
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30); // Anunț valabil 30 de zile
  const validTo = futureDate.toISOString(); 

  // 2. Maparea numelor atributelor
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

  // 3. Adăugăm Kilometrajul (câmp nativ)
  if (listing.mileage) {
    properties.push({ key: "km", value: listing.mileage.toString() });
  }

  // 4. Procesăm atributele dinamice
  // Logăm pentru debug ce avem în DB
  console.log("[BestAuto DEBUG] Atribute brute:", 
    listing.attributeValues?.map(av => `${av.attribute.name}: ${av.stringValue}`)
  );

  if (listing.attributeValues) {
    listing.attributeValues.forEach((av) => {
      // Normalizăm numele: "Marcă" -> "marca", "Putere (CP)" -> "putere cp"
      const dbAttrName = av.attribute.name.toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 

      // Căutăm cheia potrivită
      const bestAutoKey = Object.keys(attributesMap).find(key => 
        dbAttrName.includes(key)
      );

      if (bestAutoKey) {
        let val = av.stringValue || av.numberValue?.toString() || (av.booleanValue ? "Da" : "Nu");
        
        properties.push({
          key: attributesMap[bestAutoKey],
          value: val
        });
      }
    });
  }

  // 5. PLASĂ DE SIGURANȚĂ: Dacă lipsesc 'make' sau 'model', le ghicim din Titlu
  // BestAuto respinge anunțul cu "Invalid model!" dacă lipsesc astea.
  const hasMake = properties.some(p => p.key === 'make');
  if (!hasMake) {
    const guessedMake = listing.title.split(' ')[0] || "Other";
    properties.push({ key: 'make', value: guessedMake });
    console.log(`[BestAuto WARNING] 'make' lipsă. Adăugat din titlu: ${guessedMake}`);
  }

  const hasModel = properties.some(p => p.key === 'model');
  if (!hasModel) {
     const guessedModel = listing.title.split(' ')[1] || "Other";
     properties.push({ key: 'model', value: guessedModel });
     console.log(`[BestAuto WARNING] 'model' lipsă. Adăugat din titlu: ${guessedModel}`);
  }

  // 6. Construim obiectul final
  return {
    user: {
      email: "contact@awdauto.ro" 
    },
    ad: {
      active: true,
      promoted: false,
      externalid: listing.id,
      category: 21, 
      price: listing.price || 0,
      currency: "EUR",
      title: listing.title,
      text: listing.description || "Detalii la telefon.",
      
      // Câmpurile de timp obligatorii
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
      },
      properties: properties,
      pictures: listing.images.map((img, index) => ({
        url: img.url,
        rank: index + 1
      }))
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