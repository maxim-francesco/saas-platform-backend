const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const BASE_URL = 'http://localhost:4400';

async function request(method, url, data, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await axios({
      method: method.toUpperCase(),
      url: `${BASE_URL}${url}`,
      data,
      headers
    });
    return res;
  } catch (error) {
    const fullUrl = `${BASE_URL}${url}`;
    if (error.response) {
      console.error(`Method: ${method.toUpperCase()}`);
      console.error(`URL: ${fullUrl}`);
      console.error(`HTTP Status: ${error.response.status}`);
      console.error(`Response Body: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`Method: ${method.toUpperCase()}`);
      console.error(`URL: ${fullUrl}`);
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

async function run() {
  // STEP 0 — GUARD
  // Login as demo
  const loginDemoResForGuard = await request('POST', '/api/auth/login', {
    email: 'demo.auto@email.com',
    password: 'Test1234!'
  });
  const demoTokenForGuard = loginDemoResForGuard.data.token;

  // GET /api/network/transport/mine
  const transportMineResForGuard = await request('GET', '/api/network/transport/mine', null, demoTokenForGuard);
  const runsForGuard = transportMineResForGuard.data;
  const matchingRuns = runsForGuard.filter(run => 
    (run.fromCity === 'Cluj-Napoca' && run.toCity === 'Bucuresti') ||
    (run.fromCity === 'Munchen' && run.toCity === 'Cluj-Napoca')
  );
  const alreadyApplied = matchingRuns.length >= 2;

  if (alreadyApplied) {
    console.log("GUARD: seed already applied. Run teardown first.");
    process.exit(0);
  }
  console.log("GUARD: clean, proceeding.");

  // STEP 1 — LOGIN all four accounts
  const accounts = [
    { key: 'demo', email: 'demo.auto@email.com', name: 'demo' },
    { key: 'alpha', email: 'test.alpha@network.test', name: 'alpha' },
    { key: 'beta', email: 'test.beta@network.test', name: 'beta' },
    { key: 'gamma', email: 'test.gamma@network.test', name: 'gamma' }
  ];

  const tokens = {};
  for (const acc of accounts) {
    const loginRes = await request('POST', '/api/auth/login', {
      email: acc.email,
      password: 'Test1234!'
    });
    tokens[acc.key] = loginRes.data.token;
    console.log(`${acc.name} login OK`);
  }

  // STEP 2 — NETWORK PROFILES (PATCH /api/network/settings)
  const profileDemoRes = await request('PATCH', '/api/network/settings', {
    city: "Cluj-Napoca",
    networkDisplayName: "Demo Auto Premium",
    networkContactPhone: "0758990675",
    networkContactEmail: "contact@demoauto.ro"
  }, tokens.demo);
  console.log(JSON.stringify(profileDemoRes.data));

  const profileAlphaRes = await request('PATCH', '/api/network/settings', {
    city: "Oradea",
    networkDisplayName: "Alpha Auto",
    networkContactPhone: "0740555666",
    networkContactEmail: "contact@alpha.test"
  }, tokens.alpha);
  console.log(JSON.stringify(profileAlphaRes.data));

  // STEP 3 — PICK DEMO'S TWO CARS
  // a) As demo: GET /api/network/trade/slow-stock?days=60
  const slowStockRes = await request('GET', '/api/network/trade/slow-stock?days=60', null, tokens.demo);
  console.log(JSON.stringify(slowStockRes.data));

  const slowStock = slowStockRes.data;
  const SLOW_CAR = slowStock[0];

  // b) As demo: GET /api/listings
  const listingsRes = await request('GET', '/api/listings', null, tokens.demo);
  const listings = listingsRes.data;

  const slowStockIds = slowStock.map(c => c.listingId);
  const freshCars = listings.filter(c => c.status === "AVAILABLE" && !slowStockIds.includes(c.id));
  const FRESH_CAR = freshCars[0];

  // c) If either is missing, print what was found and exit(1).
  if (!SLOW_CAR || !FRESH_CAR) {
    console.error("Missing cars:", {
      slowCarFound: !!SLOW_CAR,
      freshCarFound: !!FRESH_CAR,
      slowStockLength: slowStock.length,
      availableListingsLength: listings.filter(c => c.status === "AVAILABLE").length
    });
    process.exit(1);
  }

  console.log(`SLOW_CAR=${SLOW_CAR.listingId} ${SLOW_CAR.title}`);
  console.log(`FRESH_CAR=${FRESH_CAR.id} ${FRESH_CAR.title}`);

  // STEP 4 — DEMO EXPOSES BOTH (POST /api/network/trade/expose, as demo)
  const slowB2bPrice = Math.round(SLOW_CAR.price - 1000);
  const freshB2bPrice = Math.round(FRESH_CAR.price - 500);

  const exposeSlowRes = await request('POST', '/api/network/trade/expose', {
    listingId: SLOW_CAR.listingId,
    b2bPrice: slowB2bPrice,
    acceptsTrade: true,
    note: "Disponibilă imediat, acte la zi."
  }, tokens.demo);
  console.log(exposeSlowRes.data.id);

  const exposeFreshRes = await request('POST', '/api/network/trade/expose', {
    listingId: FRESH_CAR.id,
    b2bPrice: freshB2bPrice,
    acceptsTrade: false,
    note: "Doar vânzare, fără schimb."
  }, tokens.demo);
  console.log(exposeFreshRes.data.id);

  const slowCarTradeId = exposeSlowRes.data.id;
  const freshCarTradeId = exposeFreshRes.data.id;

  // STEP 5 — NEGOTIATIONS
  // 5a) As BETA: POST /api/network/trade/negotiations
  const betaNegoRes = await request('POST', '/api/network/trade/negotiations', {
    tradeListingId: slowCarTradeId,
    kind: "BUY",
    offeredPrice: Math.round(slowB2bPrice - 1500),
    note: "Ofer cash, pot ridica săptămâna asta."
  }, tokens.beta);
  console.log(JSON.stringify(betaNegoRes.data));

  // 5b) As demo: GET /api/network/trade → find the item whose car.title contains "Ford Kuga"
  const tradeBrowseRes = await request('GET', '/api/network/trade', null, tokens.demo);
  const tradeListings = tradeBrowseRes.data;
  const fordKuga = tradeListings.find(item => item.car && item.car.title && item.car.title.includes("Ford Kuga"));
  if (!fordKuga) {
    console.error(JSON.stringify(tradeListings));
    process.exit(1);
  }
  console.log(fordKuga.id);
  const fordKugaTradeId = fordKuga.id;

  // 5c) As demo: POST /api/network/trade/negotiations
  const demoNegoRes = await request('POST', '/api/network/trade/negotiations', {
    tradeListingId: fordKugaTradeId,
    kind: "BUY",
    offeredPrice: 17500,
    note: "Ofer 17.500, plata pe loc."
  }, tokens.demo);
  console.log(JSON.stringify(demoNegoRes.data));
  const NEG_KUGA = demoNegoRes.data.id;

  // 5d) As GAMMA: POST /api/network/trade/negotiations/<NEG_KUGA>/counter
  const gammaCounterRes = await request('POST', `/api/network/trade/negotiations/${NEG_KUGA}/counter`, {
    kind: "BUY",
    offeredPrice: 18200,
    note: "Cobor la 18.200, e ultimul preț."
  }, tokens.gamma);
  console.log(JSON.stringify(gammaCounterRes.data));

  // STEP 6 — TRANSPORT (as demo, POST /api/network/transport)
  const now = new Date();
  const dateRunA = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();
  const dateRunB = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString();

  const runARes = await request('POST', '/api/network/transport', {
    kind: "OFFER",
    fromCity: "Cluj-Napoca",
    toCity: "Bucuresti",
    departureDate: dateRunA,
    seatsTotal: 3,
    pricePerCar: 200,
    transportType: "PLATFORM_OPEN",
    acceptsNonRunning: false,
    notes: "Plec joi dimineață, mai am locuri."
  }, tokens.demo);
  console.log(runARes.data.id);
  const RunA = runARes.data.id;

  const runBRes = await request('POST', '/api/network/transport', {
    kind: "REQUEST",
    fromCity: "Munchen",
    toCity: "Cluj-Napoca",
    departureDate: dateRunB,
    seatsTotal: 2,
    notes: "Caut transport pentru 2 mașini."
  }, tokens.demo);
  console.log(runBRes.data.id);

  // STEP 7 — INTERESTS ON DEMO'S RUN A
  const interestBetaRes = await request('POST', `/api/network/transport/${RunA}/interest`, {
    seatsRequested: 1,
    note: "O mașină, plătesc la încărcare."
  }, tokens.beta);
  console.log(JSON.stringify(interestBetaRes.data));

  const interestGammaRes = await request('POST', `/api/network/transport/${RunA}/interest`, {
    seatsRequested: 2,
    note: "Două mașini, sunt în Timișoara."
  }, tokens.gamma);
  console.log(JSON.stringify(interestGammaRes.data));

  // STEP 8 — CONVERSATIONS
  const BETA_BIZ = 'cmrtmay8o0003vedo1q32ljb0';
  const GAMMA_BIZ = 'cmrud6eb80000ve9kqamu2227';
  const ALPHA_BIZ = 'cmrtmaw5a0000vedou3g833vb';
  const DEMO_BIZ = 'cmgnq24pn0081p02egm5pimf0';

  // 8a) As BETA
  const convBetaRes = await request('POST', '/api/network/conversations', {
    otherBusinessId: DEMO_BIZ,
    contextType: "GENERAL"
  }, tokens.beta);
  const convBetaId = convBetaRes.data.id;
  console.log(convBetaId);

  const msgBeta1Res = await request('POST', `/api/network/conversations/${convBetaId}/messages`, {
    body: "Salut! Mai ai Octavia din anunț?"
  }, tokens.beta);
  console.log(msgBeta1Res.data.id);

  const msgBeta2Res = await request('POST', `/api/network/conversations/${convBetaId}/messages`, {
    body: "Dacă e disponibilă, o iau săptămâna asta."
  }, tokens.beta);
  console.log(msgBeta2Res.data.id);

  // 8b) As GAMMA
  const convGammaRes = await request('POST', '/api/network/conversations', {
    otherBusinessId: DEMO_BIZ,
    contextType: "TRADE",
    contextId: fordKugaTradeId
  }, tokens.gamma);
  const convGammaId = convGammaRes.data.id;
  console.log(convGammaId);

  const msgGammaRes = await request('POST', `/api/network/conversations/${convGammaId}/messages`, {
    body: "Am văzut oferta ta. Te sun mâine dimineață."
  }, tokens.gamma);
  console.log(msgGammaRes.data.id);

  // 8c) As demo
  const convDemoRes = await request('POST', '/api/network/conversations', {
    otherBusinessId: ALPHA_BIZ,
    contextType: "GENERAL"
  }, tokens.demo);
  const convDemoId = convDemoRes.data.id;
  console.log(convDemoId);

  const msgDemoRes = await request('POST', `/api/network/conversations/${convDemoId}/messages`, {
    body: "Bună ziua, ce mașini aveți pentru export?"
  }, tokens.demo);
  console.log(msgDemoRes.data.id);

  // STEP 9 — FINAL SUMMARY BLOCK
  // EXPOSED count
  const myTradeRes = await request('GET', '/api/network/trade/mine', null, tokens.demo);
  const exposedCount = myTradeRes.data.length;

  // NEGOTIATIONS and AWAITING count
  const myNegoRes = await request('GET', '/api/network/trade/negotiations', null, tokens.demo);
  const negotiationsList = myNegoRes.data;
  const negotiationsCount = negotiationsList.length;
  const awaitingCount = negotiationsList.filter(n => n.awaitingMyResponse === true).length;

  // MY_RUNS count
  const myRunsRes = await request('GET', '/api/network/transport/mine', null, tokens.demo);
  const myRunsCount = myRunsRes.data.length;

  // UNSEEN_INTERESTS count
  const unseenInterestsRes = await request('GET', '/api/network/transport/interests/count', null, tokens.demo);
  const unseenInterestsCount = unseenInterestsRes.data.count;

  // CONVERSATIONS count
  const myConversationsRes = await request('GET', '/api/network/conversations', null, tokens.demo);
  const conversationsCount = myConversationsRes.data.length;

  // UNREAD count
  const unreadCountRes = await request('GET', '/api/network/conversations/unread/count', null, tokens.demo);
  const unreadCount = unreadCountRes.data.count;

  console.log("SEED_OK");
  console.log(`EXPOSED=${exposedCount}`);
  console.log(`NEGOTIATIONS=${negotiationsCount}`);
  console.log(`AWAITING=${awaitingCount}`);
  console.log(`MY_RUNS=${myRunsCount}`);
  console.log(`UNSEEN_INTERESTS=${unseenInterestsCount}`);
  console.log(`CONVERSATIONS=${conversationsCount}`);
  console.log(`UNREAD=${unreadCount}`);
}

run();
