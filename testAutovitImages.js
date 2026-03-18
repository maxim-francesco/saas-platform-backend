// testAutovitImages.js
require("dotenv").config();
const { getAccessToken, createImageCollection } = require("./src/services/autovitService");

// Câteva imagini publice de test (JPG-uri reale accesibile)
const TEST_IMAGES = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/2019_Honda_Civic_sedan_%28facelift%2C_white%29%2C_front_8.21.19.jpg/1280px-2019_Honda_Civic_sedan_%28facelift%2C_white%29%2C_front_8.21.19.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/2019_Honda_Civic_sedan_%28facelift%2C_white%29%2C_rear_8.21.19.jpg/1280px-2019_Honda_Civic_sedan_%28facelift%2C_white%29%2C_rear_8.21.19.jpg",
];

async function main() {
  console.log("=== Test creare colecție imagini Autovit ===\n");

  try {
    // 1. Obținem token
    const token = await getAccessToken(
      "1751",
      "a8000946efe2724d443ce4a458eef1ec",
      "maaximfrancesco@gmail.com",
      "U2NUWVZ4LKL7e*"
    );
    console.log("✅ Token obținut\n");

    // 2. Creăm colecția de imagini
    const imageCollectionId = await createImageCollection(
      TEST_IMAGES,
      token,
      "maaximfrancesco@gmail.com"
    );

    console.log("\n✅ Colecție imagini creată cu succes!");
    console.log("  image_collection_id:", imageCollectionId);
    console.log("\n→ Acest ID va fi folosit la crearea anunțului.");

  } catch (error) {
    console.error("\n❌ Eroare:", error.message);
  }
}

main();