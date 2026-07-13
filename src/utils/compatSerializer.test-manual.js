// src/utils/compatSerializer.test-manual.js
const prisma = require("../config/prismaClient");
const { toLegacyListing } = require("./compatSerializer");

async function run() {
  console.log("Starting manual compatibility serializer checks...");

  const audiId = 'cmmnj2pd100gap828x4e55ock';
  const bmwId = 'cmmnj2pb600fqp828sb1ecbw9';

  const audiListing = await prisma.listing.findUnique({
    where: { id: audiId },
    include: {
      make: true,
      model: true,
      features: true,
      images: { orderBy: { order: "asc" } }
    }
  });

  const bmwListing = await prisma.listing.findUnique({
    where: { id: bmwId },
    include: {
      make: true,
      model: true,
      features: true,
      images: { orderBy: { order: "asc" } }
    }
  });

  if (!audiListing) {
    console.error("FAIL: Audi A4 listing not found in saasv2!");
    process.exit(1);
  }
  if (!bmwListing) {
    console.error("FAIL: BMW Seria 3 listing not found in saasv2!");
    process.exit(1);
  }

  // Run serialization
  const audiSerialized = toLegacyListing(audiListing, { mode: 'byId' });
  const bmwSerialized = toLegacyListing(bmwListing, { mode: 'byId' });

  // Expected values for Audi A4
  const expectedAudi = {
    "Marca": "Audi",
    "Model": "A4",
    "An": 2019,
    "Kilometraj": 98000,
    "Pret": 21000,
    "Combustibil": "Diesel",
    "Cutie de viteze": "Manuala",
    "Capacitate cilindrică": 1968,
    "Putere (CP)": 150
  };

  let audiPass = true;
  console.log("\n=== Checking Audi A4 Serialized Attributes ===");
  for (const [name, val] of Object.entries(expectedAudi)) {
    const av = audiSerialized.attributeValues.find(a => a.attribute.name === name);
    if (!av) {
      console.log(`[FAIL] ${name}: attribute not found!`);
      audiPass = false;
      continue;
    }

    const actualVal = av.stringValue !== null ? av.stringValue : (av.numberValue !== null ? av.numberValue : av.booleanValue);
    if (actualVal === val) {
      console.log(`[PASS] ${name}: ${actualVal}`);
    } else {
      console.log(`[FAIL] ${name}: expected ${val}, got ${actualVal}`);
      audiPass = false;
    }
  }

  // Expected values for BMW Seria 3
  const expectedBmw = {
    "Marca": "BMW",
    "Model": "Seria 3",
    "An": 2018,
    "Kilometraj": 120000,
    "Pret": 18500,
    "Combustibil": "Diesel",
    "Cutie de viteze": "Manuala",
    "Capacitate cilindrică": 1995,
    "Putere (CP)": 190
  };

  let bmwPass = true;
  console.log("\n=== Checking BMW Seria 3 Serialized Attributes ===");
  for (const [name, val] of Object.entries(expectedBmw)) {
    const av = bmwSerialized.attributeValues.find(a => a.attribute.name === name);
    if (!av) {
      console.log(`[FAIL] ${name}: attribute not found!`);
      bmwPass = false;
      continue;
    }

    const actualVal = av.stringValue !== null ? av.stringValue : (av.numberValue !== null ? av.numberValue : av.booleanValue);
    if (actualVal === val) {
      console.log(`[PASS] ${name}: ${actualVal}`);
    } else {
      console.log(`[FAIL] ${name}: expected ${val}, got ${actualVal}`);
      bmwPass = false;
    }
  }

  console.log("\n=== Full Audi A4 Serialized JSON ===");
  console.log(JSON.stringify(audiSerialized, null, 2));

  if (audiPass && bmwPass) {
    console.log("\nALL TESTS PASSED!");
    process.exit(0);
  } else {
    console.error("\nSOME TESTS FAILED!");
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
