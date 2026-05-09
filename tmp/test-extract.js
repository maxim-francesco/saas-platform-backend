const axios = require('axios');
const cheerio = require('cheerio');

async function extractDetail() {
  try {
    // Get listing
    const resList = await axios.get('https://davocars.ro/masini');
    let $ = cheerio.load(resList.data);
    let carLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/masina/') && !carLinks.includes(href)) {
         carLinks.push(href);
      }
    });
    
    console.log("Found car links length:", carLinks.length);
    if(carLinks.length === 0) return;
    
    // Pick 2 links as sample
    const sampleLinks = carLinks.slice(2, 4);
    for (let link of sampleLinks) {
       console.log("\n===========================");
       console.log("Extracting: " + link);
       const res = await axios.get(link);
       const $d = cheerio.load(res.data);
       
       console.log("Title (H1):", $d('h1').text().trim());
       
       const price1 = $d('.price').text().trim();
       const price2 = $d('span').filter((i, el) => $(el).text().includes('€') || $(el).text().includes('EUR')).first().text().trim();
       console.log("Probable price 1:", price1);
       console.log("Probable price 2:", price2);
       
       // Let's print out all specs. They might be in a list or table or description list
       console.log("\nSpecs List:");
       $d('li').each((i, el) => {
         const text = $d(el).text().replace(/\s+/g, ' ').trim();
         // simple heuristic for spec (e.g. "Marca Dacia")
         if (text.length > 3 && text.length < 50 && text.includes(':')) {
             console.log("   ", text);
         } else if (text.length > 3 && text.length < 50 && $d(el).find('strong, span, b').length > 0) {
             console.log("   ", text);
         }
       });
       
       console.log("\nTable Specs:");
       $d('tr').each((i, el) => {
          const key = $d(el).find('th, td').eq(0).text().replace(/\s+/g, ' ').trim();
          const val = $d(el).find('td').eq(1).text().replace(/\s+/g, ' ').trim();
          if (key && val) console.log("   ", key, "->", val);
       });
       
       console.log("\nDescription:");
       console.log($d('p').map((i,el)=>$d(el).text()).get().join(' ').substring(0, 200), "...");
       
       console.log("\nImages:");
       console.log($d('img').map((i,el)=>$d(el).attr('src')).get().filter(src => src && src.includes('uploads')).slice(0, 3));
    }

  } catch (e) {
    console.error(e.message);
  }
}

extractDetail();
