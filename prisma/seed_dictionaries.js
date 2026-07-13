const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed dictionaries...');

  // Load files
  const makesPath = path.join(__dirname, '../autovit_makes.json');
  const mappingsPath = path.join(__dirname, '../etl/etl_value_mappings.json');

  const makesData = JSON.parse(fs.readFileSync(makesPath, 'utf8'));
  const mappingsData = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));

  // MAKES
  const makesOptions = makesData.options || {};
  let makeCount = 0;
  for (const [slug, info] of Object.entries(makesOptions)) {
    const name = info.ro || slug;
    await prisma.make.upsert({
      where: { slug: slug },
      update: { name: name, autovitCode: slug },
      create: { name: name, slug: slug, autovitCode: slug }
    });
    makeCount++;
  }
  console.log(`Upserted ${makeCount} makes.`);

  // FEATURES
  const featuresList = mappingsData.featureDictionary || [];
  let featureCount = 0;
  for (const feat of featuresList) {
    const { slug, name, group } = feat;
    await prisma.feature.upsert({
      where: { slug: slug },
      update: { name: name, group: group },
      create: { name: name, slug: slug, group: group }
    });
    featureCount++;
  }
  console.log(`Upserted ${featureCount} features.`);

  // Print final counts in DB to verify
  const dbMakesCount = await prisma.make.count();
  const dbFeaturesCount = await prisma.feature.count();
  console.log(`Total Makes in DB: ${dbMakesCount}`);
  console.log(`Total Features in DB: ${dbFeaturesCount}`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
