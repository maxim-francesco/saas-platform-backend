// testAutovitActivate.js
require("dotenv").config();
const { getAccessToken, deactivateAdvert } = require("./src/services/autovitService");

const ADVERT_ID = 7059849219;

async function main() {
  console.log("=== Test dezactivare anunț Autovit ===\n");

  try {
    const token = await getAccessToken(
      "1751",
      "a8000946efe2724d443ce4a458eef1ec",
      "maaximfrancesco@gmail.com",
      "U2NUWVZ4LKL7e*"
    );
    console.log("✅ Token obținut\n");

    console.log(`Dezactivez anunțul ${ADVERT_ID}...`);
    const result = await deactivateAdvert(ADVERT_ID, token, "maaximfrancesco@gmail.com");
    console.log("✅ Anunț dezactivat!");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("❌ Eroare:", error.message);
  }
}

main();