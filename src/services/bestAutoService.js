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


  // --- ASIGURĂ-TE CĂ ACEST BLOC ESTE AICI, LA ÎNCEPUTUL FUNCȚIEI ---
  const now = new Date();
  const validFrom = now.toISOString(); // Definim validFrom AICI
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const validTo = futureDate.toISOString(); // Definim validTo AICI
  // ------------------------------------------------------------------
  // Mapare simplă a atributelor (trebuie ajustată în funcție de numele exacte din DB-ul tău)
  // Cheile din stânga sunt numele atributelor tale din baza de date
  // Cheile din dreapta sunt ce așteaptă BestAuto
  const attributesMap = {
    "Marca": "make",
    "Model": "model",
    "An": "carregistrationdate",
    "Combustibil": "carfueltype",
    "Caroserie": "carbody",
    "Putere (CP)": "carpower",
    "Capacitate cilindrică": "carcmc"
  };

  const properties = [];

  // Mapează kilometrajul (câmp nativ la tine)
  if (listing.mileage) {
    properties.push({ key: "km", value: listing.mileage.toString() });
  }

  // Mapează atributele dinamice
  if (listing.attributeValues) {
    listing.attributeValues.forEach((av) => {
      const dbAttrName = av.attribute.name;
      // Verificăm dacă avem o mapare pentru acest atribut
      const bestAutoKey = Object.keys(attributesMap).find(key => 
        dbAttrName.toLowerCase().includes(key.toLowerCase())
      );

      if (bestAutoKey) {
        let val = av.stringValue || av.numberValue?.toString() || (av.booleanValue ? "Da" : "Nu");
        
        // Conversie specială pentru Combustibil (BestAuto vrea probabil format specific)
        // Aici poți adăuga logică extra dacă e nevoie
        
        properties.push({
          key: attributesMap[bestAutoKey],
          value: val
        });
      }
    });
  }

  // Construcția obiectului final conform PDF-ului
  return {
    user: {
      email: "contact@awdauto.ro" // Sau un email din setările business-ului
    },
    ad: {
      active: true,
      promoted: false, // Default false, poate fi configurabil
      externalid: listing.id, // ID-ul tău intern
      category: 21, // 21 = Autoturisme
      price: listing.price || 0,
      currency: "EUR",
      title: listing.title,
      text: listing.description || "",
      contact: {
        contactName: business.name,
        contactEmail: "contact@awdauto.ro", // Ar trebui luat din business settings
        contactPhone: "0752228593" // Ar trebui luat din business settings
      },
      location: {
        countyName: "Cluj", // Hardcodat momentan sau luat din atribute
        cityName: "Cluj-Napoca"
      },
      // --- CÂMPURI NOI ADĂUGATE ---
      // --- FOLOSIM VARIABILELE DEFINITE MAI SUS ---
      validFrom: validFrom,  // Aici crăpa înainte
      validTo: validTo,
      // -------------------------------------------
      // ----------------------------
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