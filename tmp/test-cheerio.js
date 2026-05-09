const axios = require('axios');
const cheerio = require('cheerio');

async function discover() {
  console.log("Fetching https://www.davocars.ro...");
  try {
    const res = await axios.get('https://www.davocars.ro/');
    const $ = cheerio.load(res.data);
    const links = $('a').map((i, el) => $(el).attr('href')).get();
    const uniqueLinks = [...new Set(links)];
    
    // Try to guess the car detail format
    const possibleCarLinks = uniqueLinks.filter(l => l && (l.match(/-[0-9]+$/) || l.includes('oferte') || l.includes('masini') || l.includes('auto') || l.includes('details')));
    
    console.log("Sample of unique links:");
    console.log(uniqueLinks.slice(0, 20).join('\n'));
    console.log("\nPossible car links:", possibleCarLinks.slice(0, 10).join('\n'));
    
    let listingPage = uniqueLinks.find(l => l.includes('stoc') || l.includes('masini') || l.includes('oferte'));
    console.log("\nPossible listing page:", listingPage);
    
    // Let's fetch one of the car links to see its structure
    // Find a link that looks like a detail page, usually they have a long slug and an ID or something
    const detailLink = uniqueLinks.find(l => l && l.includes('/masini/') && l.length > 20);
    if (detailLink) {
       console.log("\nFetching detail page:", detailLink);
       const detailRes = await axios.get(detailLink.startsWith('http') ? detailLink : `https://www.davocars.ro${detailLink}`);
       const $d = cheerio.load(detailRes.data);
       console.log("Title:", $d('title').text());
       console.log("H1:", $d('h1').text());
       
       // try to extract elements that could be specs
       console.log("\nElements that might be specs:");
       $d('li, tr, .spec, .car-detail, .features, dl').each((i, el) => {
         const text = $d(el).text().replace(/\s+/g, ' ').trim();
         if (text.length > 5 && text.length < 100 && i < 20) {
            console.log("Potential spec:", text);
         }
       });
    }

  } catch (error) {
    console.error("Error during discovery:", error.message);
  }
}

discover();
