const axios = require('axios');
const cheerio = require('cheerio');

async function extractDetailHtml() {
  const url = 'https://davocars.ro/masina/dacia-lodgy-motor-1-2-benzina-an-2013/';
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  
  // Try to find the container that holds the specs
  const possibleContainers = ['ul', 'dl', 'table', '.elementor-widget-container', '.elementor-text-editor'];
  
  console.log("Looking for specs...");
  $('.elementor-icon-list-item').each((i, el) => {
    console.log("Icon list item:", $(el).text().replace(/\s+/g, ' ').trim());
  });

  $('.elementor-text-editor p, .elementor-text-editor li').each((i, el) => {
     const t = $(el).text().trim();
     if (t && t.length < 50) {
        console.log("Text editor item:", t);
     }
  });

  console.log("All typical car details class:");
  $('[class*="car"], [class*="detail"], [class*="spec"], [class*="attr"], [class*="feature"]').each((i,el) => {
     const t = $(el).text().replace(/\s+/g, ' ').trim();
     if(t.length > 5 && t.length < 100) console.log("Class " + $(el).attr('class') + " -> " + t);
  });
  
  // Also show images
  const images = [];
  $('img').each((i, el) => {
    if($(el).attr('src') && $(el).attr('src').includes('uploads')) {
      images.push($(el).attr('src'));
    }
  });
  console.log("Images:", images);

  console.log("\nPrice element:", $('.elementor-heading-title:contains("€")').text());
}

extractDetailHtml();
