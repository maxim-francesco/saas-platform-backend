// testAutovitParams.js
require("dotenv").config();
const { getAccessToken } = require("./src/services/autovitService");
const axios = require("axios");
const fs = require("fs");

const BASE_URL = "https://www.autovit.ro/api/open";
const USER = "maaximfrancesco@gmail.com";

async function main() {
  const token = await getAccessToken(
    "1751", "a8000946efe2724d443ce4a458eef1ec",
    USER, "U2NUWVZ4LKL7e*"
  );
  const headers = { "User-Agent": USER, Authorization: `Bearer ${token}` };

  // 1. Modele BMW
  const models = await axios.get(`${BASE_URL}/categories/29/models/bmw`, { headers });
  fs.writeFileSync("autovit_models_bmw.json", JSON.stringify(models.data, null, 2));
  console.log("✅ Modele BMW salvate în autovit_models_bmw.json");

  // 2. Categoria 29 - toți parametrii
  const category = await axios.get(`${BASE_URL}/categories/29`, { headers });
  fs.writeFileSync("autovit_category_29.json", JSON.stringify(category.data, null, 2));
  console.log("✅ Categoria 29 salvată în autovit_category_29.json");

  // 3. Mărci
  const makes = await axios.get(`${BASE_URL}/categories/29/makes`, { headers });
  fs.writeFileSync("autovit_makes.json", JSON.stringify(makes.data, null, 2));
  console.log("✅ Mărci salvate în autovit_makes.json");
}

main().catch(e => console.error(e.response?.data || e.message));