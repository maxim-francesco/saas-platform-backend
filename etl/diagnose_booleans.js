const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const { mapEnum, mapFeatures, mappingsData } = require('./transform');

async function run() {
  console.log('--- TASK 2: transform.js Behavior ---');
  console.log("mapEnum('airConditioning', 'true') ->", JSON.stringify(mapEnum('airConditioning', 'true')));
  console.log("mapEnum('airConditioning', 'climatronic') ->", JSON.stringify(mapEnum('airConditioning', 'climatronic')));
  console.log("mapEnum('drivetrain', 'true') ->", JSON.stringify(mapEnum('drivetrain', 'true')));
  console.log("mapEnum('gearbox', 'true') ->", JSON.stringify(mapEnum('gearbox', 'true')));
  console.log("mapFeatures('Trapa', true, 'BOOLEAN') ->", JSON.stringify(mapFeatures('Trapa', true, 'BOOLEAN')));
  console.log("mapFeatures('Faruri LED', true, 'BOOLEAN') ->", JSON.stringify(mapFeatures('Faruri LED', true, 'BOOLEAN')));
  console.log("mapFeatures('Carte service', true, 'BOOLEAN') ->", JSON.stringify(mapFeatures('Carte service', true, 'BOOLEAN')));

  console.log('\n--- TASK 4: Make-in-Title Parseability for Make-Less Listings ---');

  // Initialize DB clients
  const prismaClone = new PrismaClient({
    datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
  });
  const prismaV2 = new PrismaClient();

  try {
    // 1. Fetch Makes from saasv2
    const makes = await prismaV2.make.findMany({ select: { name: true } });
    const makeNames = makes.map(m => m.name);
    console.log(`Loaded ${makeNames.length} make names from saasv2.`);

    // 2. Fetch make-less listings from saasclone
    const whitelistedBusinessIds = mappingsData.tenantWhitelist.map(t => t.businessId);
    const listings = await prismaClone.$queryRawUnsafe(`
      SELECT l.id, l.title FROM "Listing" l
      WHERE l."businessId" IN (${whitelistedBusinessIds.map(id => `'${id}'`).join(',')})
      AND NOT EXISTS (
        SELECT 1 
        FROM "AttributeValue" av
        JOIN "Attribute" a ON a.id = av."attributeId"
        WHERE av."listingId" = l.id
        AND lower(trim(a.name)) = 'marca'
      )
    `);
    console.log(`Loaded ${listings.length} make-less listings from saasclone.`);

    // 3. Perform matching
    function titleMatchesMake(title, make) {
      if (!title || !make) return false;
      const normTitle = ' ' + title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() + ' ';
      const normMake = make.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      
      let idx = normTitle.indexOf(normMake);
      while (idx !== -1) {
        const charBefore = normTitle[idx - 1];
        const charAfter = normTitle[idx + normMake.length];
        const isBeforeAlphaNum = /[a-z0-9]/.test(charBefore);
        const isAfterAlphaNum = /[a-z0-9]/.test(charAfter);
        if (!isBeforeAlphaNum && !isAfterAlphaNum) {
          return true;
        }
        idx = normTitle.indexOf(normMake, idx + 1);
      }
      return false;
    }

    const matchedListings = [];
    const unmatchedListings = [];

    for (const l of listings) {
      let matchedMake = null;
      for (const make of makeNames) {
        if (titleMatchesMake(l.title, make)) {
          matchedMake = make;
          break;
        }
      }
      if (matchedMake) {
        matchedListings.push({ title: l.title, make: matchedMake });
      } else {
        unmatchedListings.push(l.title);
      }
    }

    console.log(`Total make-less listings: ${listings.length}`);
    console.log(`Titles matching at least one known make: ${matchedListings.length}`);
    console.log(`Titles matching none: ${unmatchedListings.length}`);

    console.log('\n--- 15 Example matches (title -> matched-make) ---');
    matchedListings.slice(0, 15).forEach(m => {
      console.log(`"${m.title}" -> "${m.make}"`);
    });

    console.log('\n--- 15 Example unmatched ---');
    unmatchedListings.slice(0, 15).forEach(title => {
      console.log(`"${title}"`);
    });

  } catch (err) {
    console.error('Error during diagnostics:', err);
  } finally {
    await prismaClone.$disconnect();
    await prismaV2.$disconnect();
  }
}

run();
