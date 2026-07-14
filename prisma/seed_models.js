const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function normalize(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function cleanModelName(str) {
  if (!str) return '';
  let cleaned = str.replace(/\s+/g, ' ').trim();
  const hasLetters = /[a-zA-Z]/.test(cleaned);
  const isAllCaps = hasLetters && cleaned === cleaned.toUpperCase();
  if (isAllCaps) {
    // Title-Case words
    cleaned = cleaned.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
  }
  return cleaned;
}

function slugify(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}


async function main() {
  console.log('Starting CarModel seeding...');

  const mappingsPath = path.join(__dirname, '../etl/etl_value_mappings.json');
  const mappingsData = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
  const whitelistedBusinessIds = mappingsData.tenantWhitelist.map(t => t.businessId);
  const makeNormalization = mappingsData.makeNormalization || {};

  // Clients
  const prismaClone = new PrismaClient({
    datasources: { db: { url: process.env.SOURCE_DATABASE_URL } }
  });
  const prismaV2 = new PrismaClient();

  // Load Makes from saasv2
  const dbMakes = await prismaV2.make.findMany();
  const makeSlugToId = {};
  for (const m of dbMakes) {
    makeSlugToId[m.slug] = m.id;
  }

  // Load EAV attributes from saasclone
  const query = `
    SELECT 
      av."listingId",
      a.name AS "attrName",
      av."stringValue"
    FROM "AttributeValue" av
    JOIN "Attribute" a ON av."attributeId" = a.id
    JOIN "Listing" l ON av."listingId" = l.id
    WHERE l."businessId" IN (${whitelistedBusinessIds.map(id => `'${id}'`).join(',')})
  `;
  
  console.log('Querying saasclone EAV data...');
  const rows = await prismaClone.$queryRawUnsafe(query);
  console.log(`Fetched ${rows.length} attribute value rows.`);

  const listings = {};
  for (const row of rows) {
    if (!listings[row.listingId]) {
      listings[row.listingId] = {};
    }
    const normName = normalize(row.attrName);
    if (normName === 'marca' || normName === 'model') {
      listings[row.listingId][normName] = row.stringValue ? row.stringValue.trim() : '';
    }
  }

  const distinctPairs = new Map();
  for (const [listingId, attrs] of Object.entries(listings)) {
    const makeRaw = attrs.marca || '';
    const modelRaw = attrs.model || '';
    if (!makeRaw || !modelRaw) continue;

    const key = `${makeRaw.toLowerCase()}||${modelRaw.toLowerCase()}`;
    if (!distinctPairs.has(key)) {
      distinctPairs.set(key, { makeRaw, modelRaw, count: 0 });
    }
    distinctPairs.get(key).count++;
  }

  const modelsToSeed = new Map();
  const unresolvedMakes = new Set();

  for (const pair of distinctPairs.values()) {
    const normalizedMake = normalize(pair.makeRaw);
    const makeSlug = makeNormalization[normalizedMake];

    if (!makeSlug || !makeSlugToId[makeSlug]) {
      unresolvedMakes.add(pair.makeRaw);
      continue;
    }

    const makeId = makeSlugToId[makeSlug];
    const displayModel = cleanModelName(pair.modelRaw);
    const modelSlug = slugify(displayModel);

    if (!modelSlug) continue;

    const modelKey = `${makeId}||${modelSlug}`;
    if (!modelsToSeed.has(modelKey)) {
      modelsToSeed.set(modelKey, {
        makeId,
        makeSlug,
        slug: modelSlug,
        name: displayModel,
        count: 0
      });
    }
    const entry = modelsToSeed.get(modelKey);
    entry.count += pair.count;

    // Prefer nicer mixed-cased name if available
    const displayModelIsAllCaps = displayModel === displayModel.toUpperCase() && /[a-zA-Z]/.test(displayModel);
    const entryNameIsAllCaps = entry.name === entry.name.toUpperCase() && /[a-zA-Z]/.test(entry.name);
    if (!displayModelIsAllCaps && entryNameIsAllCaps) {
      entry.name = displayModel;
    }
  }

  console.log(`Upserting ${modelsToSeed.size} CarModels in saasv2...`);
  let createdCount = 0;
  for (const model of modelsToSeed.values()) {
    await prismaV2.carModel.upsert({
      where: {
        makeId_slug: {
          makeId: model.makeId,
          slug: model.slug
        }
      },
      update: {
        name: model.name
      },
      create: {
        makeId: model.makeId,
        slug: model.slug,
        name: model.name
      }
    });
    createdCount++;
  }

  console.log(`Seeding complete. Upserted ${createdCount} CarModels.`);

  const makeCounts = {};
  for (const model of modelsToSeed.values()) {
    makeCounts[model.makeSlug] = (makeCounts[model.makeSlug] || 0) + 1;
  }
  const sortedMakes = Object.entries(makeCounts).sort((a, b) => b[1] - a[1]);
  console.log('\nTop 10 makes with seeded models:');
  for (let i = 0; i < Math.min(10, sortedMakes.length); i++) {
    console.log(`- ${sortedMakes[i][0]}: ${sortedMakes[i][1]} models`);
  }

  console.log('\nUnresolved makes list:', Array.from(unresolvedMakes));

  await prismaClone.$disconnect();
  await prismaV2.$disconnect();
}

main().catch((e) => {
  console.error('Error during CarModel seeding:', e);
  process.exit(1);
});
