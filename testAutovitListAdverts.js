// testAutovitCreateAdvert.js
require("dotenv").config();
const { getAccessToken } = require("./src/services/autovitService");
const axios = require("axios");

const BASE_URL = "https://www.autovit.ro/api/open";

async function main() {
  console.log("=== Test creare anunț Autovit ===\n");

  try {
    const token = await getAccessToken(
      "1751",
      "a8000946efe2724d443ce4a458eef1ec",
      "maaximfrancesco@gmail.com",
      "U2NUWVZ4LKL7e*"
    );
    console.log("✅ Token obținut\n");

    console.log("Pas 1: Creare colecție imagini...");
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

    console.log("\nPas 2: Creare anunț...");

    const advertPayload = {
      external_id: "test-001",
      email: "maaximfrancesco@gmail.com",
      image_collection_id: imageCollectionId,
      partner_offer_url: "https://example.com/masina-test-001",
      contact_phone: "0700000000",
      description: "Mașină de test pentru integrare API. Nu contactați.",
      params: {
        make: "ford",
        model: "focus",
        year: 2018,
        mileage: { unit: "kilometers", value: 85000 },
        engine_capacity: { unit: "cubic_centimeters", value: 1600 },
        engine_power: { unit: "horsepower", value: 115 },
        fuel_type: "gasoline",
        gearbox: "manual",
        body_type: "hatchback",
        color: "white",
        price: { currency: "RON", value: 12500 },
        condition: "used",
        country_origin: "ro",
        registered_country: "ro",
        first_registration_year: 2018,
        first_registration_month: 6,
        doors: "4/5",
        nr_seats: 5,
      },
      region_id: 7,
      city_id: 671,
    };

    const advertResponse = await axios.post(
      `${BASE_URL}/adverts`,
      advertPayload,
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