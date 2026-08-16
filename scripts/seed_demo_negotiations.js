const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4400';

const credentials = {
  Alpha: { email: 'test.alpha@network.test', password: 'Test1234!' },
  Beta: { email: 'test.beta@network.test', password: 'Test1234!' },
  Gamma: { email: 'test.gamma@network.test', password: 'Test1234!' }
};

async function run() {
  try {
    // STEP 0 — Login
    const tokens = {};
    for (const name of Object.keys(credentials)) {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: credentials[name].email,
        password: credentials[name].password
      });
      tokens[name] = response.data.token;
    }

    const alphaHeaders = { Authorization: `Bearer ${tokens.Alpha}` };
    const betaHeaders = { Authorization: `Bearer ${tokens.Beta}` };
    const gammaHeaders = { Authorization: `Bearer ${tokens.Gamma}` };

    // Fetch existing trade listings
    // Beta's listings are visible to Alpha
    const alphaTradeListings = (await axios.get(`${BASE_URL}/api/network/trade`, { headers: alphaHeaders })).data;
    // Alpha's listings are visible to Beta
    const betaTradeListings = (await axios.get(`${BASE_URL}/api/network/trade`, { headers: betaHeaders })).data;

    let audiA6TradeId = null;
    let skodaOctaviaTradeId = null;
    let fordKugaTradeId = null;
    let bmwX5TradeId = null;

    for (const tl of alphaTradeListings) {
      if (tl.car.title.includes("Audi A6")) audiA6TradeId = tl.id;
      if (tl.car.title.includes("Skoda Octavia")) skodaOctaviaTradeId = tl.id;
      if (tl.car.title.includes("Ford Kuga")) fordKugaTradeId = tl.id;
    }

    for (const tl of betaTradeListings) {
      if (tl.car.title.includes("BMW X5")) bmwX5TradeId = tl.id;
    }

    console.log("RESOLVED TRADE LISTINGS:");
    console.log(`- Audi A6 Trade Listing ID (Beta): ${audiA6TradeId}`);
    console.log(`- Skoda Octavia Trade Listing ID (Beta): ${skodaOctaviaTradeId}`);
    console.log(`- Ford Kuga Trade Listing ID (Gamma): ${fordKugaTradeId}`);
    console.log(`- BMW X5 Trade Listing ID (Alpha): ${bmwX5TradeId}`);

    if (!audiA6TradeId || !bmwX5TradeId) {
      console.log("\nWARNING: Some expected trade listings are missing!");
      console.log("Present listings visible to Alpha:");
      console.log(JSON.stringify(alphaTradeListings.map(t => ({ title: t.car.title, id: t.id })), null, 2));
      console.log("Present listings visible to Beta:");
      console.log(JSON.stringify(betaTradeListings.map(t => ({ title: t.car.title, id: t.id })), null, 2));
    }

    // STEP 1 — Alpha as BUYER
    console.log("\n--- STEP 1 ---");
    let ALPHA_BUYS = null;
    try {
      const response = await axios.post(`${BASE_URL}/api/network/trade/negotiations`, {
        tradeListingId: audiA6TradeId,
        kind: "BUY",
        offeredPrice: 23000,
        note: "Ofer 23.000, plata pe loc"
      }, { headers: alphaHeaders });
      ALPHA_BUYS = response.data.id;
      console.log(`ALPHA_BUYS negotiation created. ID: ${ALPHA_BUYS}`);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        ALPHA_BUYS = err.response.data.negotiationId;
        console.log(`ALPHA_BUYS negotiation already exists. ID: ${ALPHA_BUYS}`);
      } else {
        console.error("Step 1 failed:", err.response ? err.response.data : err.message);
        throw err;
      }
    }

    // STEP 2 — Alpha as SELLER
    console.log("\n--- STEP 2 ---");
    let GAMMA_BUYS_ALPHA = null;
    try {
      const response = await axios.post(`${BASE_URL}/api/network/trade/negotiations`, {
        tradeListingId: bmwX5TradeId,
        kind: "BUY",
        offeredPrice: 35000,
        note: "Cumpar BMW-ul, 35k"
      }, { headers: gammaHeaders });
      GAMMA_BUYS_ALPHA = response.data.id;
      console.log(`GAMMA_BUYS_ALPHA negotiation created. ID: ${GAMMA_BUYS_ALPHA}`);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        GAMMA_BUYS_ALPHA = err.response.data.negotiationId;
        console.log(`GAMMA_BUYS_ALPHA negotiation already exists. ID: ${GAMMA_BUYS_ALPHA}`);
      } else {
        console.error("Step 2 failed:", err.response ? err.response.data : err.message);
        throw err;
      }
    }

    // STEP 3 — exchange example
    console.log("\n--- STEP 3 ---");
    // Ensure Beta has an AVAILABLE car to offer
    const betaListings = (await axios.get(`${BASE_URL}/api/listings`, { headers: betaHeaders })).data;
    const betaAvailable = betaListings.filter(l => l.status === 'AVAILABLE');

    let offeredListingId = null;
    const existingDemoCar = betaAvailable.find(l => l.title === "Demo Beta TradeIn");
    if (existingDemoCar) {
      offeredListingId = existingDemoCar.id;
      console.log(`Using existing Beta AVAILABLE car: ${existingDemoCar.title} (ID: ${offeredListingId})`);
    } else {
      console.log("Creating a new AVAILABLE car for Beta: Demo Beta TradeIn");
      const newCar = await axios.post(`${BASE_URL}/api/listings`, {
        title: "Demo Beta TradeIn",
        price: 17000,
        year: 2018,
        mileage: 100000,
        fuelType: "PETROL",
        gearbox: "MANUAL",
        bodyType: "HATCHBACK",
        status: "AVAILABLE"
      }, { headers: betaHeaders });
      offeredListingId = newCar.data.id;
      console.log(`Created car. ID: ${offeredListingId}`);
    }

    let BETA_EXCHANGES_ALPHA = null;
    try {
      const response = await axios.post(`${BASE_URL}/api/network/trade/negotiations`, {
        tradeListingId: bmwX5TradeId,
        kind: "EXCHANGE",
        offeredListingId: offeredListingId,
        offeredPrice: 18000,
        note: "Masina mea + 18.000 pentru BMW"
      }, { headers: betaHeaders });
      BETA_EXCHANGES_ALPHA = response.data.id;
      console.log(`BETA_EXCHANGES_ALPHA negotiation created. ID: ${BETA_EXCHANGES_ALPHA}`);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        BETA_EXCHANGES_ALPHA = err.response.data.negotiationId;
        console.log(`BETA_EXCHANGES_ALPHA negotiation already exists. ID: ${BETA_EXCHANGES_ALPHA}`);
      } else {
        console.error("Step 3 failed:", err.response ? err.response.data : err.message);
        throw err;
      }
    }

    // VERIFY V1
    console.log("\n--- VERIFY V1 ---");
    const v1Res = await axios.get(`${BASE_URL}/api/network/trade/negotiations`, { headers: alphaHeaders });
    console.log("RAW V1 RESPONSE (GET /api/network/trade/negotiations):");
    console.log(JSON.stringify(v1Res.data, null, 2));

    console.log("\nParsed negotiations for operator (Alpha):");
    v1Res.data.forEach(n => {
      const title = n.car?.title || "Unknown Car";
      const role = n.role;
      const status = n.status;
      const awaitingMyResponse = n.awaitingMyResponse;
      const latestKind = n.latestProposal?.kind || "N/A";
      const latestAmount = n.latestProposal?.offeredPrice !== undefined ? n.latestProposal.offeredPrice : "N/A";
      console.log(`- Car: "${title}", Role: ${role}, Status: ${status}, AwaitingMyResponse: ${awaitingMyResponse}, LatestProposal: ${latestKind} (Amount: ${latestAmount})`);
    });

    // VERIFY V2
    console.log("\n--- VERIFY V2 ---");
    const v2Res = await axios.get(`${BASE_URL}/api/network/trade/negotiations/pending/count`, { headers: alphaHeaders });
    console.log("RAW V2 RESPONSE (GET /api/network/trade/negotiations/pending/count):");
    console.log(JSON.stringify(v2Res.data, null, 2));

    // VERIFY V3
    console.log("\n--- VERIFY V3 ---");
    const v3Res = await axios.get(`${BASE_URL}/api/network/trade/negotiations/${GAMMA_BUYS_ALPHA}`, { headers: alphaHeaders });
    console.log("RAW V3 RESPONSE (GET /api/network/trade/negotiations/GAMMA_BUYS_ALPHA):");
    console.log(JSON.stringify(v3Res.data, null, 2));

    // Write to a local file for findstr verification
    const outPath = path.join(__dirname, 'v3_detail.json');
    fs.writeFileSync(outPath, JSON.stringify(v3Res.data, null, 2));
    console.log(`\nSuccessfully wrote V3 response to ${outPath}`);

  } catch (error) {
    console.error("Fatal run error:", error.response ? error.response.data : error.message);
  }
}

run();
