const axios = require('axios');
const fs = require('fs');

async function downloadHtml() {
  const url = 'https://davocars.ro/masina/dacia-lodgy-motor-1-2-benzina-an-2013/';
  const res = await axios.get(url);
  fs.writeFileSync('../saas-platform-backend/tmp/lodgy.html', res.data);
  console.log("Saved lodgy.html");
}

downloadHtml();
