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
      title: "[TEST API] Ford Focus 2018 - Nu contactati",
      description: "Anunt de test pentru integrare API. Nu contactati.",
      category_id: 29,
      region_id: 1,
      city_id: 1,
      advertiser_type: "business",
      image_collection_id: imageCollectionId,
      contact: {
        person: "Test Dealer",
        phones: ["0700000000"],
      },
      params: {
        make: "ford",
        model: "focus",
        year: 2018,
        mileage: 85000,
        fuel_type: "petrol",
        engine_power: "115",
        engine_capacity: "1596",
        gearbox: "manual",
        body_type: "hatchback",
        color: "white",
        price: {
          "0": "price",
          "1": 12500,
          currency: "RON",
          gross_net: "gross",
        },
        condition: "used",
        is_imported_car: false,
        first_registration_year: 2018,
      },
    };

    console.log("Payload trimis:", JSON.stringify(advertPayload, null, 2));

    const advertResponse = await axios.post(
      `${BASE_URL}/account/adverts`,  // <-- endpoint corect
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