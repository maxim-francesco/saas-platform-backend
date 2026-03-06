// testAutovitExtract.js
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("autovit_category_29.json", "utf8"));

const params = data.parameters;
console.log("Tip parameters:", typeof params);
console.log("Este array:", Array.isArray(params));
console.log("Lungime:", params.length);

params.forEach(param => {
  if (["body_type", "color"].includes(param.code)) {
    console.log(`\n=== ${param.code} ===`);
    console.log(JSON.stringify(param.options, null, 2));
  }
});