// testAutovitCategory.js
require("dotenv").config();
const { getAccessToken } = require("./src/services/autovitService");
const axios = require("axios");

const BASE_URL = "https://www.autovit.ro/api/open";

async function main() {
  try {
    const token = await getAccessToken(
      "1751",
      "a8000946efe2724d443ce4a458eef1ec",
      "maaximfrancesco@gmail.com",
      "U2NUWVZ4LKL7e*"
    );

    const response = await axios.get(`${BASE_URL}/categories/29`, {
      headers: {
        "User-Agent": "maaximfrancesco@gmail.com",
        Authorization: `Bearer ${token}`,
      },
    });

    // Filtrăm doar câmpurile obligatorii
    const params = response.data.params || response.data.fields || [];
    const required = params.filter(p => p.required === true);

    console.log("=== CÂMPURI OBLIGATORII pentru categoria 29 ===\n");
    required.forEach(p => {
      console.log(`• ${p.code} (${p.type})`);
      if (p.options) {
        console.log(`  Valori acceptate: ${Object.keys(p.options).join(", ")}`);
      }
    });

    console.log(`\nTotal obligatorii: ${required.length}`);

  } catch (error) {
    console.error("❌", error.response?.data || error.message);
  }
}

main();