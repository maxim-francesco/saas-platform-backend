const prisma = require("../config/prismaClient");
const { generateText } = require("../services/geminiService");

const FUEL = {
  PETROL: "Benzină",
  DIESEL: "Diesel",
  PETROL_LPG: "Benzină + GPL",
  LPG: "GPL",
  HYBRID: "Hibrid",
  PLUGIN_HYBRID: "Hibrid plug-in",
  MILD_HYBRID: "Mild hybrid",
  ELECTRIC: "Electric"
};

const GEARBOX = {
  MANUAL: "Manuală",
  AUTOMATIC: "Automată"
};

const DRIVETRAIN = {
  FWD: "Tracțiune față",
  RWD: "Tracțiune spate",
  AWD: "Tracțiune integrală (4x4)"
};

const BODY = {
  SUV: "SUV",
  SEDAN: "Berlină",
  HATCHBACK: "Hatchback",
  BREAK: "Break (Combi)",
  COUPE: "Coupé",
  CABRIO: "Cabrio",
  MONOVOLUM: "Monovolum",
  VAN: "Van",
  PICKUP: "Pick-up"
};

const POLLUTION = {
  NON_EURO: "Non-Euro",
  EURO_1: "Euro 1",
  EURO_2: "Euro 2",
  EURO_3: "Euro 3",
  EURO_4: "Euro 4",
  EURO_5: "Euro 5",
  EURO_6: "Euro 6",
  EURO_6D: "Euro 6d"
};

const COLOR = {
  BLACK: "Negru",
  GREY: "Gri",
  WHITE: "Alb",
  BLUE: "Albastru",
  RED: "Roșu",
  BROWN: "Maro",
  SILVER: "Argintiu",
  ORANGE: "Portocaliu",
  GREEN: "Verde",
  PURPLE: "Mov",
  GOLD: "Auriu",
  BEIGE: "Bej",
  YELLOW: "Galben",
  OTHER: ""
};

const UPHOLSTERY = {
  FABRIC: "Textil",
  VELOUR: "Velur",
  LEATHER: "Piele",
  PARTIAL_LEATHER: "Semipiele",
  ALCANTARA: "Alcantara"
};

const AC = {
  NONE: "Fără",
  MANUAL: "Aer condiționat manual",
  AUTOMATIC: "Climatronic",
  DUAL_ZONE: "Climatronic pe 2 zone",
  TRI_ZONE: "Climatronic pe 3 zone",
  QUAD_ZONE: "Climatronic pe 4 zone"
};

const COUNTRY = {
  DE: "Germania",
  FR: "Franța",
  IT: "Italia",
  NL: "Olanda",
  BE: "Belgia",
  AT: "Austria",
  ES: "Spania",
  RO: "România",
  HU: "Ungaria",
  PL: "Polonia",
  CH: "Elveția",
  GB: "Marea Britanie",
  SE: "Suedia",
  DK: "Danemarca",
  LU: "Luxemburg",
  CZ: "Cehia",
  SK: "Slovacia",
  PT: "Portugalia",
  US: "SUA"
};

const SYSTEM_INSTRUCTION = "Ești un copywriter specializat în anunțuri auto pentru un dealer de mașini rulate din România. Primești specificațiile reale ale unei mașini și scrii o descriere comercială în limba română.\n\nREGULI STRICTE:\n- Folosește EXCLUSIV informațiile din specificația primită. Nu inventa dotări, istoric, caracteristici tehnice, garanții sau afirmații care nu apar explicit în date.\n- Integrează ACTIV datele concrete primite. Menționează explicit, atunci când apar în specificație, informațiile pe care le caută un cumpărător de mașini rulate: anul de fabricație, rulajul în km, motorizarea (combustibil, capacitate cilindrică, putere) și cutia de viteze. Acestea sunt principalele argumente de vânzare — prezintă-le clar, nu le trata ca detalii minore și nu le omite dacă există în date.\n- Dacă o informație lipsește, pur și simplu nu o menționa. Nu presupune și nu completa cu valori tipice.\n- Nu inventa prețuri, promoții sau oferte.\n- Evită superlativele nefondate, clișeele goale (ex. „cea mai bună mașină din țară\", „ideală pentru oraș\") și formulările vagi care înlocuiesc datele reale. Preferă faptele concrete din specificație în locul frazelor generice.\n- Ton profesionist, curat, atractiv, dar factual și credibil.\n- Scrie DOAR text simplu, în paragrafe separate printr-o linie goală. FĂRĂ markdown, fără titluri, fără liste cu buline sau simboluri.\n- Lungime: 2-4 paragrafe scurte.\n- Scrie în limba română corectă, cu diacritice.";


async function buildListingSpec(body) {
  let makeName = "";
  if (body.makeId) {
    const makeObj = await prisma.make.findUnique({ where: { id: body.makeId } });
    if (makeObj) makeName = makeObj.name;
  }

  let modelName = "";
  if (body.modelId) {
    const modelObj = await prisma.carModel.findUnique({ where: { id: body.modelId } });
    if (modelObj) modelName = modelObj.name;
  }

  if (!makeName && !modelName && !body.year) {
    return null;
  }

  const lines = [];

  if (makeName) lines.push(`Marcă: ${makeName}`);
  if (modelName) lines.push(`Model: ${modelName}`);
  if (body.variant) lines.push(`Variantă: ${body.variant}`);
  if (body.year) lines.push(`An fabricație: ${body.year}`);

  let firstRegStr = "";
  if (body.firstRegistrationAt) {
    const d = new Date(body.firstRegistrationAt);
    if (!isNaN(d.getTime())) {
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      firstRegStr = `${month}/${year}`;
    }
  }
  if (firstRegStr) lines.push(`Prima înmatriculare: ${firstRegStr}`);

  if (body.countryOfOrigin) {
    const co = body.countryOfOrigin.toUpperCase();
    const roCountry = COUNTRY[co] || co;
    if (roCountry) lines.push(`Țară de origine: ${roCountry}`);
  }

  if (body.registeredInRo === true) lines.push(`Înmatriculată în România: Da`);

  if (body.mileage !== undefined && body.mileage !== null && body.mileage !== "") {
    const val = Number(body.mileage);
    if (!isNaN(val)) {
      lines.push(`Rulaj: ${val.toLocaleString("ro-RO")} km`);
    }
  }

  if (body.fuelType && FUEL[body.fuelType]) lines.push(`Combustibil: ${FUEL[body.fuelType]}`);
  if (body.gearbox && GEARBOX[body.gearbox]) lines.push(`Cutie de viteze: ${GEARBOX[body.gearbox]}`);
  if (body.drivetrain && DRIVETRAIN[body.drivetrain]) lines.push(`Transmisie: ${DRIVETRAIN[body.drivetrain]}`);
  if (body.bodyType && BODY[body.bodyType]) lines.push(`Tip caroserie: ${BODY[body.bodyType]}`);

  if (body.engineCapacity !== undefined && body.engineCapacity !== null && body.engineCapacity !== "") {
    const val = Number(body.engineCapacity);
    if (!isNaN(val)) lines.push(`Capacitate cilindrică: ${val} cm³`);
  }

  if (body.powerHp !== undefined && body.powerHp !== null && body.powerHp !== "") {
    const val = Number(body.powerHp);
    if (!isNaN(val)) lines.push(`Putere: ${val} CP`);
  }

  if (body.pollutionNorm && POLLUTION[body.pollutionNorm]) lines.push(`Normă de poluare: ${POLLUTION[body.pollutionNorm]}`);

  if (body.co2Emissions !== undefined && body.co2Emissions !== null && body.co2Emissions !== "") {
    const val = Number(body.co2Emissions);
    if (!isNaN(val)) lines.push(`Emisii CO2: ${val} g/km`);
  }

  if (body.color && COLOR[body.color]) lines.push(`Culoare: ${COLOR[body.color]}`);
  if (body.colorDetail) lines.push(`Detalii culoare: ${body.colorDetail}`);
  if (body.upholstery && UPHOLSTERY[body.upholstery]) lines.push(`Tapițerie: ${UPHOLSTERY[body.upholstery]}`);
  if (body.airConditioning && AC[body.airConditioning]) lines.push(`Climatizare: ${AC[body.airConditioning]}`);

  if (body.doors !== undefined && body.doors !== null && body.doors !== "") {
    lines.push(`Număr uși: ${body.doors}`);
  }
  if (body.seats !== undefined && body.seats !== null && body.seats !== "") {
    lines.push(`Număr locuri: ${body.seats}`);
  }

  if (body.vatDeductible === true) lines.push(`TVA deductibil: Da`);
  if (body.noAccidents === true) lines.push(`Fără accidente: Da`);
  if (body.serviceBook === true) lines.push(`Carte service: Da`);
  if (body.firstOwner === true) lines.push(`Primul proprietar: Da`);

  if (body.ownerCount !== undefined && body.ownerCount !== null && body.ownerCount !== "") {
    lines.push(`Număr proprietari: ${body.ownerCount}`);
  }
  if (body.warrantyMonths !== undefined && body.warrantyMonths !== null && body.warrantyMonths !== "") {
    lines.push(`Garanție: ${body.warrantyMonths} luni`);
  }

  if (body.featureIds && Array.isArray(body.featureIds) && body.featureIds.length > 0) {
    const dbFeatures = await prisma.feature.findMany({
      where: { id: { in: body.featureIds } },
      select: { name: true }
    });
    if (dbFeatures.length > 0) {
      const featureNames = dbFeatures.map(f => f.name).join(", ");
      lines.push(`Dotări: ${featureNames}`);
    }
  }

  return lines.join("\n");
}

async function generateDescription(req, res) {
  try {
    const spec = await buildListingSpec(req.body);
    if (!spec) {
      return res.status(400).json({ error: "Date insuficiente pentru generarea descrierii. Completează măcar marca, modelul și anul." });
    }
    const prompt = "Scrie descrierea pentru următoarea mașină:\n\n" + spec;
    const description = await generateText({ systemInstruction: SYSTEM_INSTRUCTION, prompt });
    res.json({ description: description.trim() });
  } catch (error) {
    console.error("[Gemini API Error]", error);
    if (error.message && error.message.includes("GEMINI_API_KEY is not set")) {
      return res.status(500).json({ error: "Serviciul AI nu este configurat (lipsește cheia)." });
    }
    return res.status(502).json({ error: "Generarea a eșuat. Încearcă din nou." });
  }
}

module.exports = { generateDescription };
