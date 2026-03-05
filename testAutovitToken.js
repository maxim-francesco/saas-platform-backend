// testAutovitToken.js
require("dotenv").config();
const { getAccessToken } = require("./src/services/autovitService");

async function main() {
  console.log("Se încearcă obținerea unui token de la Autovit...");

  try {
    const token = await getAccessToken(
      "1751",
      "a8000946efe2724d443ce4a458eef1ec",
      "maaximfrancesco@gmail.com",
      "U2NUWVZ4LKL7e*"
    );

    console.log("✅ Token obținut cu succes!");
    console.log("  Token (primele 20 caractere):", token.substring(0, 20) + "...");
  } catch (error) {
    console.error("❌ Eroare:", error.message);
  }
}

main();