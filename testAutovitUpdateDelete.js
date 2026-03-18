// testAutovitUpdateDelete.js
require("dotenv").config();
const { getAccessToken, updateAdvert, deleteAdvert } = require("./src/services/autovitService");

const ADVERT_ID = 7059849219;

async function main() {
  console.log("=== Test update + delete anunț Autovit ===\n");

  try {
    const token = await getAccessToken(
      "1751",
      "a8000946efe2724d443ce4a458eef1ec",
      "maaximfrancesco@gmail.com",
      "U2NUWVZ4LKL7e*"
    );
    console.log("✅ Token obținut\n");

    // UPDATE — payload complet conform documentației
    console.log(`Actualizez anunțul ${ADVERT_ID}...`);
    const updated = await updateAdvert(
      ADVERT_ID,
      {
        title: "[TEST API] Ford Focus 2018 - Nu contactati (updated)",
        description: "Anunt de test actualizat prin API. Nu contactati.",
        category_id: 29,
        region_id: 1,
        city_id: 1,
        advertiser_type: "business",
        image_collection_id: "868192375",
        contact: { person: "Test Dealer" },
        new_used: "used",
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
          is_imported_car: 0,
          price: {
            "0": "price",
            "1": 11000,  // pret modificat
            currency: "RON",
            gross_net: "gross",
          },
        },
      },
      token,
      "maaximfrancesco@gmail.com"
    );
    console.log("✅ Anunț actualizat!");
    console.log(JSON.stringify(updated, null, 2));

    await new Promise(r => setTimeout(r, 2000));

    // DELETE
    console.log(`\nȘterg anunțul ${ADVERT_ID}...`);
    await deleteAdvert(ADVERT_ID, token, "maaximfrancesco@gmail.com");
    console.log("✅ Anunț șters!");

  } catch (error) {
    console.error("❌ Eroare:", error.message);
  }
}

main();