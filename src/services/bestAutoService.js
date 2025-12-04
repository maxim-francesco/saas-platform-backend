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
  // Formatăm data simplu, fără milisecunde, poate asta e problema
  const now = new Date();
  const validFrom = now.toISOString().split('.')[0]; // Scoatem milisecundele și Z-ul
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const validTo = futureDate.toISOString().split('.')[0]; 

  // Hardcodăm proprietățile critice pentru a testa validarea
  // Dacă asta merge, înseamnă că una din proprietățile dinamice era de vină
  const properties = [
    { key: "make", value: "Mercedes-Benz" }, // Încearcă Mercedes-Benz
    { key: "model", value: "GLA" },
    { key: "carregistrationdate", value: "2014" },
    { key: "km", value: listing.mileage ? listing.mileage.toString() : "100000" },
    { key: "carfueltype", value: "Diesel" },
    { key: "carbody", value: "SUV" },
    { key: "carpower", value: "136" },
    { key: "carcmc", value: "2143" }
  ];

  return {
    user: {
      email: "contact@awdauto.ro"
    },
    ad: {
      active: true,
      promoted: false,
      externalid: listing.id,
      category: 21,
      price: listing.price || 1, // Asigură-te că nu e 0
      currency: "EUR",
      title: listing.title.substring(0, 50), // Limităm lungimea titlului
      text: "Test integrare", // Text scurt
      
      validFrom: validFrom,
      validTo: validTo,

      // Eliminăm contact și location pentru moment (sunt opționale în unele doc-uri sau au valori default)
      // Dacă crapă, le punem la loc
      
      properties: properties,
      
      // Trimitem doar o poză de test
      pictures: listing.images.length > 0 ? [{ url: listing.images[0].url, rank: 1 }] : []
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