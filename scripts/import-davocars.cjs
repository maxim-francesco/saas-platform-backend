const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

const BUSINESS_ID = "cmhomcpoi02x1ut2cpips3mo3";
const CATEGORY_ID = "cmhomehci02x5ut2c5139sde9";

const ATTRIBUTES_MAP = {
  price: "cmhon7ys702xput2caq5agg51",
  "an fabricației": "cmhon8dwy02xrut2c4bjkxikq",
  "an fabricație": "cmhon8dwy02xrut2c4bjkxikq", // fallback
  "kilometraj": "cmhon8hcj02xtut2cjqfg0lq8",
  "combustibil": "cmhon8kqj02xvut2cxr86u1qz",
  "capacitate cilindrică": "cmhon8njk02xxut2cssdbzci3",
  "putere": "cmhon8qrb02xzut2cp8o6cwh4",
  "putere (cp)": "cmhon8qrb02xzut2cp8o6cwh4",
  "transmisie": "cmhon8u0n02y1ut2c5jnuf3l3",
  "culoare": "cmhon8wpl02y3ut2c8jdbox9e",
  "norma de poluare": "cmhon903u02y5ut2cifxcyol0",
  "normă de poluare": "cmhon903u02y5ut2cifxcyol0",
  "tracțiune": "cmhon96ae02y7ut2cjq4o8vr7",
  "număr proprietari": "cmhonb1pz02zdut2cz85hnnpz",
  "număr de proprietari": "cmhonb1pz02zdut2cz85hnnpz"
};

const IS_DRY_RUN = process.argv.includes('--dry-run');

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateSlug = (text) => {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

async function processImage(url, business, listingId, index, dryRun) {
  try {
    const response = await axios({ url, responseType: "arraybuffer", timeout: 10000 });
    let imageBuffer = Buffer.from(response.data, "binary");
    const STANDARD_WIDTH = 1600;

    let processedImagePipeline = sharp(imageBuffer).resize({ width: STANDARD_WIDTH, withoutEnlargement: false });
    imageBuffer = await processedImagePipeline.toBuffer();
    
    if (business.bannerUrl) {
      const metadata = await sharp(imageBuffer).metadata();
      const BANNER_HEIGHT = 150;
      try {
        const bannerResponse = await axios({ url: business.bannerUrl, responseType: "arraybuffer", timeout: 10000 });
        const bannerInputBuffer = Buffer.from(bannerResponse.data, "binary");
        const bannerResizedBuffer = await sharp(bannerInputBuffer)
          .resize({ width: metadata.width, height: BANNER_HEIGHT, fit: "fill" })
          .toBuffer();
        
        imageBuffer = await sharp(imageBuffer)
          .extend({ bottom: BANNER_HEIGHT, background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .composite([{ input: bannerResizedBuffer, gravity: "south" }])
          .jpeg({ quality: 90 })
          .toBuffer();
      } catch (err) {
        console.error(`  [!] Error applying banner for image ${url}:`, err.message);
        imageBuffer = await processedImagePipeline.jpeg({ quality: 90 }).toBuffer();
      }
    } else {
      imageBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
    }

    if (dryRun) {
      return { url: url, simulated: true, sizeInBytes: imageBuffer.length };
    }

    // Actual Upload
    return new Promise((resolve, reject) => {
      const folderPath = `saas-platform/${business.id}/${listingId}`;
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: "image", folder: folderPath },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            listingId: listingId,
            order: index
          });
        }
      );
      uploadStream.end(imageBuffer);
    });

  } catch (error) {
    console.error(`  [!] Failed to download or process image ${url}:`, error.message);
    return null;
  }
}

async function scrapeListingDetails(url) {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);
  
  const title = $('h1').first().text().trim();
  
  let priceStr = $('span').filter((i, el) => $(el).text().includes('€') || $(el).text().includes('EUR')).first().text().trim();
  let priceVal = null;
  if (priceStr) {
    let cleanPrice = priceStr.replace(/[^\d.,]/g, '');
    cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
    priceVal = parseFloat(cleanPrice);
  }

  const attributes = [];
  let mileage = null;
  
  $('.elementor-icon-box-wrapper').each((i, el) => {
    const key = $(el).find('.elementor-icon-box-title').text().replace(/\s+/g, ' ').trim().toLowerCase();
    const val = $(el).find('.elementor-icon-box-description').text().replace(/\s+/g, ' ').trim();
    
    if (key && val && val !== '-') {
      const mappedId = ATTRIBUTES_MAP[key];
      if (mappedId) {
        let cleanVal = val;
        // determine if number or string based on key
        if (["an fabricației", "an fabricație", "kilometraj", "capacitate cilindrică", "putere", "putere (cp)", "număr proprietari", "număr de proprietari"].includes(key)) {
            let numStr = val.replace(/[^\d.]/g, '');
            if (numStr) {
              const numVal = parseFloat(numStr);
              attributes.push({ attributeId: mappedId, value: numVal, type: "NUMBER" });
              if (key === "kilometraj") mileage = numVal;
            }
        } else {
            attributes.push({ attributeId: mappedId, value: cleanVal, type: "STRING" });
        }
      }
    }
  });

  const description = $('.elementor-element.elementor-widget-theme-post-content').text().trim() || 
                      $('.elementor-text-editor').text().trim() || 
                      `Anunț preluat de pe davocars.ro`;

  const images = [];
  $('img').each((i, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-elementor-open-lightbox');
    if ($(el).parent('a').attr('href') && $(el).parent('a').attr('href').match(/\.(jpg|jpeg|png)$/i)) {
      src = $(el).parent('a').attr('href'); // Highest quality is usually the link target
    }
    
    if (src && src.includes('uploads') && !src.includes('.svg') && !src.includes('-150x150') && !src.includes('-300x')) {
       if (!images.includes(src)) images.push(src);
    }
  });

  return { title, price: priceVal, mileage, attributes, description, images };
}

async function main() {
  console.log(`Starting Davocars Import Script... [DRY RUN: ${IS_DRY_RUN}]`);
  
  try {
    const business = await prisma.business.findUnique({ where: { id: BUSINESS_ID } });
    if (!business) throw new Error("Business not found in DB.");
    console.log(`Target Business: ${business.name} (Banner: ${business.bannerUrl || 'None'})`);

    let carLinks = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`-> Fetching catalog page ${page}...`);
      try {
        const url = page === 1 ? 'https://davocars.ro/masini' : `https://davocars.ro/masini/page/${page}/`;
        const resList = await axios.get(url);
        let $ = cheerio.load(resList.data);
        
        let foundOnPage = 0;
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('/masina/') && !carLinks.includes(href)) {
             carLinks.push(href);
             foundOnPage++;
          }
        });
        
        if (foundOnPage === 0) {
           hasMore = false;
        } else {
           page++;
           await sleep(300);
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
           hasMore = false;
        } else {
           console.error(`Error fetching page ${page}:`, err.message);
           hasMore = false;
        }
      }
    }

    console.log(`Found ${carLinks.length} car listings to process.`);
    const previewData = [];

    for (const link of carLinks) {
       console.log(`\n-> Scraping ${link}`);
       const details = await scrapeListingDetails(link);
       const slug = generateSlug(details.title);
       console.log(`   Title: ${details.title}`);
       console.log(`   Price: ${details.price} EUR, Mileage: ${details.mileage} km`);
       console.log(`   Attributes mapped: ${details.attributes.length}`);
       console.log(`   Images found: ${details.images.length}`);

       const existingListing = await prisma.listing.findFirst({ where: { slug: slug, businessId: business.id } });
       if (existingListing && !IS_DRY_RUN) {
          console.log(`   [SKIP] Listing already exists in DB (ID: ${existingListing.id}).`);
          continue;
       }

       if (IS_DRY_RUN) {
         const simImages = await Promise.all(details.images.slice(0,2).map((img, idx) => processImage(img, business, 'sim-id', idx, true)));
         console.log(`   [Simulated image processing for first 2 images]`);
         previewData.push({ url: link, data: details });
       } else {
         // Create Listing
         const newListing = await prisma.$transaction(async (tx) => {
           const listing = await tx.listing.create({
             data: {
               title: details.title,
               description: details.description,
               businessId: business.id,
               categoryId: CATEGORY_ID,
               price: details.price,
               mileage: details.mileage,
               slug: slug,
               status: 'AVAILABLE'
             }
           });

           for (const attr of details.attributes) {
             const valueData = { listingId: listing.id, attributeId: attr.attributeId };
             if (attr.type === "STRING") valueData.stringValue = attr.value.toString();
             if (attr.type === "NUMBER") valueData.numberValue = attr.value;
             // no booleans mapped currently
             await tx.attributeValue.create({ data: valueData });
           }

           if (details.price && ATTRIBUTES_MAP['price']) {
             await tx.attributeValue.create({
               data: { listingId: listing.id, attributeId: ATTRIBUTES_MAP['price'], numberValue: details.price }
             });
           }
           return listing;
         });

         console.log(`   [DB] Created listing: ${newListing.id}`);

         // Process and upload images sequentially to avoid overloading Cloudinary / memory
         for (let i = 0; i < details.images.length; i++) {
           console.log(`   [Cloudinary] Uploading image ${i + 1}/${details.images.length}...`);
           const imgData = await processImage(details.images[i], business, newListing.id, i, false);
           if (imgData) {
             await prisma.listingImage.create({ data: imgData });
           }
         }
       }

       await sleep(500); // polite scraping
    }

    if (IS_DRY_RUN) {
      fs.writeFileSync('./import-preview.json', JSON.stringify(previewData, null, 2));
      console.log(`\n[DRY RUN] Generated import-preview.json successfully.`);
    } else {
      console.log(`\nImport Completed Successfully!`);
    }

  } catch (err) {
    console.error("Fatal Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
