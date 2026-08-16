const axios = require('axios');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:4400';

async function run() {
  try {
    // STEP 0 - login
    const credentials = [
      { name: 'Alpha', email: 'test.alpha@network.test', password: 'Test1234!' },
      { name: 'Beta', email: 'test.beta@network.test', password: 'Test1234!' },
      { name: 'Gamma', email: 'test.gamma@network.test', password: 'Test1234!' }
    ];

    const tokens = {};
    const businessIds = {};

    for (const cred of credentials) {
      // prisma lookup for business id
      const user = await prisma.user.findUnique({
        where: { email: cred.email },
        select: { businessId: true }
      });
      if (!user) {
        throw new Error(`User not found: ${cred.email}`);
      }
      businessIds[cred.name] = user.businessId;

      // real API login
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: cred.email,
        password: cred.password
      });
      tokens[cred.name] = response.data.token;
      console.log(`${cred.name} login OK`);
    }

    // STEP 1 — Alpha creates 3 AVAILABLE cars via POST /api/listings (save ids A1,A2,A3)
    const listingsToCreate = [
      { title: "BMW X5 2019 xDrive", price: 38000, year: 2019, mileage: 95000, fuelType: "DIESEL", gearbox: "AUTOMATIC", bodyType: "SUV", status: "AVAILABLE" },
      { title: "Mercedes E220d 2018", price: 24000, year: 2018, mileage: 130000, fuelType: "DIESEL", gearbox: "AUTOMATIC", bodyType: "SEDAN", status: "AVAILABLE" },
      { title: "VW Golf 7 2020", price: 14500, year: 2020, mileage: 70000, fuelType: "PETROL", gearbox: "MANUAL", bodyType: "HATCHBACK", status: "AVAILABLE" }
    ];

    const alphaHeaders = { Authorization: `Bearer ${tokens.Alpha}` };
    const createdListings = [];

    for (const listing of listingsToCreate) {
      const response = await axios.post(`${BASE_URL}/api/listings`, listing, { headers: alphaHeaders });
      createdListings.push(response.data);
    }

    const A1_ID = createdListings[0].id;
    const A2_ID = createdListings[1].id;
    const A3_ID = createdListings[2].id;

    console.log(`STEP 1 OK`);

    // STEP 2 — Backdate createdAt ONLY for A1 and A2 (Alpha's, to look like slow stock).
    const ids = [A1_ID, A2_ID];
    const backdate = new Date(Date.now() - 90 * 86400000);
    const updateResult = await prisma.listing.updateMany({
      where: { id: { in: ids } },
      data: { createdAt: backdate }
    });
    console.log(`BACKDATED=${updateResult.count} to ${backdate.toISOString()}`);

    // STEP 3 — Alpha exposes A1 to B2B
    const exposeResponse = await axios.post(
      `${BASE_URL}/api/network/trade/expose`,
      { listingId: A1_ID, b2bPrice: 36500, acceptsTrade: true, note: "Preț bun pentru colegi" },
      { headers: alphaHeaders }
    );
    console.log(`STEP 3 OK`);

    // STEP 4 — Others create + expose cars so Alpha's BROWSE is full
    // Beta:
    const betaHeaders = { Authorization: `Bearer ${tokens.Beta}` };
    // Car 1: Audi A6 2019 quattro
    const betaCar1 = await axios.post(`${BASE_URL}/api/listings`, {
      title: "Audi A6 2019 quattro", price: 31000, year: 2019, mileage: 110000, fuelType: "DIESEL", gearbox: "AUTOMATIC", bodyType: "SEDAN", status: "AVAILABLE"
    }, { headers: betaHeaders });
    
    await axios.post(`${BASE_URL}/api/network/trade/expose`, {
      listingId: betaCar1.data.id, b2bPrice: 29500, acceptsTrade: true, note: "Accept schimb cu SUV"
    }, { headers: betaHeaders });

    // Car 2: Skoda Octavia 2021
    const betaCar2 = await axios.post(`${BASE_URL}/api/listings`, {
      title: "Skoda Octavia 2021", price: 16000, year: 2021, mileage: 60000, fuelType: "DIESEL", gearbox: "MANUAL", bodyType: "BREAK", status: "AVAILABLE"
    }, { headers: betaHeaders });

    await axios.post(`${BASE_URL}/api/network/trade/expose`, {
      listingId: betaCar2.data.id, b2bPrice: 15000, acceptsTrade: false, note: "Doar vânzare"
    }, { headers: betaHeaders });

    // Gamma:
    const gammaHeaders = { Authorization: `Bearer ${tokens.Gamma}` };
    // Car 1: Ford Kuga 2020
    const gammaCar1 = await axios.post(`${BASE_URL}/api/listings`, {
      title: "Ford Kuga 2020", price: 19500, year: 2020, mileage: 85000, fuelType: "DIESEL", gearbox: "AUTOMATIC", bodyType: "SUV", status: "AVAILABLE"
    }, { headers: gammaHeaders });

    await axios.post(`${BASE_URL}/api/network/trade/expose`, {
      listingId: gammaCar1.data.id, b2bPrice: 18500, acceptsTrade: true, note: "Schimb cu berlină"
    }, { headers: gammaHeaders });

    console.log(`STEP 4 OK`);

    // VERIFY
    // V1. As Alpha: GET /api/network/trade/slow-stock (default 60 days) → expect A1 and A2 present with daysInStock ~90; A1 isExposed:true; A3 NOT present (too recent). Print.
    const v1Res = await axios.get(`${BASE_URL}/api/network/trade/slow-stock`, { headers: alphaHeaders });
    console.log("V1 RESPONSE:");
    console.log(JSON.stringify(v1Res.data, null, 2));

    // V2. As Alpha: GET /api/network/trade/mine → expect A1 exposed. Print.
    const v2Res = await axios.get(`${BASE_URL}/api/network/trade/mine`, { headers: alphaHeaders });
    console.log("V2 RESPONSE:");
    console.log(JSON.stringify(v2Res.data, null, 2));

    // V3. As Alpha: GET /api/network/trade → expect the 3 exposed cars from Beta/Gamma (NOT any of Alpha's own). Print count + titles.
    const v3Res = await axios.get(`${BASE_URL}/api/network/trade`, { headers: alphaHeaders });
    console.log("V3 RESPONSE:");
    console.log(JSON.stringify(v3Res.data, null, 2));
    require('fs').writeFileSync('scripts/v3_response.json', JSON.stringify(v3Res.data, null, 2));

    // V4. As Alpha: GET /api/network/trade?acceptsTrade=true → expect only the 2 that accept trade. Print count.
    const v4Res = await axios.get(`${BASE_URL}/api/network/trade?acceptsTrade=true`, { headers: alphaHeaders });
    console.log("V4 RESPONSE:");
    console.log(JSON.stringify(v4Res.data, null, 2));

  } catch (error) {
    console.error("Execution error:", error.response ? error.response.data : error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
