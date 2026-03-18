// testAutovitPartnerAuth.js
require("dotenv").config();
const axios = require("axios");

const BASE_URL = "https://www.autovit.ro/api/open";

// client_id și client_secret sunt credențialele tale de partener
const CLIENT_ID = "1751";
const CLIENT_SECRET = "a8000946efe2724d443ce4a458eef1ec";

// Cu grant_type=partner, partner_code și partner_secret
// sunt de obicei același client_id și client_secret
// DAR uneori Autovit dă credențiale separate pentru partner flow
const PARTNER_CODE = "1751";
const PARTNER_SECRET = "a8000946efe2724d443ce4a458eef1ec";

async function getPartnerToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "partner");
  params.append("partner_code", PARTNER_CODE);
  params.append("partner_secret", PARTNER_SECRET);

  const response = await axios.post(
    `${BASE_URL}/oauth/token`,
    params.toString(),
    {
      auth: {
        username: CLIENT_ID,
        password: CLIENT_SECRET,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
}

async function main() {
  console.log("=== Test autentificare partner Autovit ===\n");

  try {
    console.log("Încerc grant_type=partner...");
    const token = await getPartnerToken();
    console.log("✅ Token partner obținut!");
    console.log("Token (primele 20 caractere):", token.substring(0, 20) + "...");

    // Testăm dacă putem posta cu acest token
    console.log("\nTestez creare colecție imagini cu token partner...");
    const imgResponse = await axios.post(
      `${BASE_URL}/imageCollections`,
      { "1": "https://i.imgur.com/7bMqysJ.jpg" },
      {
        headers: {
          "User-Agent": "maaximfrancesco@gmail.com",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Bulk-Error": "per_item",
        },
      }
    );
    const imageCollectionId = imgResponse.data.id;
    console.log("✅ image_collection_id:", imageCollectionId);

    console.log("\nTestez creare anunț cu token partner...");
    const advertResponse = await axios.post(
      `${BASE_URL}/adverts`,
      {
        external_id: "test-partner-001",
        email: "maaximfrancesco@gmail.com",
        image_collection_id: imageCollectionId,
        partner_offer_url: "https://example.com/test-partner-001",
        contact_phone: "0700000000",
        description: "Test API partner.",
        params: {
          make: "ford",
          model: "focus",
          year: 2018,
          mileage: { unit: "kilometers", value: 85000 },
          fuel_type: "gasoline",
          gearbox: "manual",
          price: { currency: "RON", value: 12500 },
          condition: "used",
        },
      },
      {
        headers: {
          "User-Agent": "maaximfrancesco@gmail.com",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("\n✅ Anunț creat cu succes!");
    console.log(JSON.stringify(advertResponse.data, null, 2));

  } catch (error) {
    console.error("\n❌ Eroare status:", error.response?.status);
    console.error("❌ Eroare date:", JSON.stringify(error.response?.data, null, 2));
  }
}

main();