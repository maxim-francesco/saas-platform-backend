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

// --- #5: Praguri diagnostic anunț (relative la media stocului businessului) ---
const DIAG_MIN_STOCK = 4;           // sub atât, stocul e prea mic pt. medie relevantă
const DIAG_HIGH_VIEWS_MULT = 1.3;   // views >= 1.3x media => "multe views"
const DIAG_LOW_VIEWS_MULT = 0.5;    // views <= 0.5x media => "puține views"
const DIAG_STALE_DAYS = 45;         // zile pe stoc pt. "stă demult"
const DIAG_TOO_NEW_DAYS = 7;        // sub atât, prea nou pt. concluzii

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


const SYSTEM_INSTRUCTION_ARTICLE = `Ești un copywriter profesionist specializat în articole de blog pentru un dealer auto din România. Scrii articole captivante și informative în limba română, folosind diacritice corecte și un ton profesional, de încredere.

Trebuie să returnezi EXCLUSIV un obiect JSON valid, fără formatare markdown sau alte texte în afara JSON-ului. Obiectul JSON trebuie să aibă structura:
{
  "title": "Titlul articolului",
  "excerpt": "Rezumat de 2-3 propoziții, text simplu, fără HTML",
  "content": "Conținutul HTML al articolului",
  "categoryKey": "cheia_categoriei"
}

REGULI STRICTE PENTRU CONȚINUTUL HTML ("content"):
1. Poți folosi EXCLUSIV următoarele taguri HTML: <p>, <h2>, <h3>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>, <a href="...">, <br>.
2. Este INTERZISĂ folosirea tagurilor <h1>, <img>, <table>, div, span sau a oricăror atribute de clasă, stil sau ID (excepție făcând atributul href la tagurile <a>).
3. Pentru tagurile <a>, atributul href trebuie să fie o cale relativă internă (de tipul "/stoc/..."). Orice legătură externă (care începe cu http, https, mailto etc.) este strict interzisă.
4. Structura articolului trebuie să conțină o introducere, între 2 și 4 secțiuni demarcate cu titluri <h2>, și o scurtă concluzie.

REGULI DE ANTI-HALUCINAȚIE (CRITICAL):
- Dacă articolul are la bază stocul de vehicule (cum ar fi modelul "top_suv_stoc"), folosește EXCLUSIV vehiculele din lista furnizată în prompt. Nu inventa alte mașini, prețuri sau dotări. Folosește EXCLUSIV link-urile URL relative primite pentru fiecare mașină ca valoare a atributului href în tagurile <a> aferente (de exemplu, <a href="/stoc/nume-slug">Marca Model</a>). Nu inventa legături/URL-uri!
- Dacă articolul este evergreen (fără stoc, ex. "diesel_vs_benzina" sau "prima_inmatriculare_de"), oferă informații generale corecte despre piața din România. Nu face promisiuni sau afirmații specifice despre stocul sau ofertele dealerului care nu sunt factual generale.
- Creează linkuri (taguri <a>) DOAR dacă în prompt ți se furnizează explicit o listă de URL-uri. Dacă NU ți se furnizează URL-uri, NU include niciun tag <a> în articol — scrie totul ca text simplu, inclusiv numele unor servicii sau resurse externe.
`;

function calcReadTime(html) {
  if (!html) return "1 min";
  const text = html.replace(/<[^>]*>/g, " ");
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const minutes = Math.max(1, Math.round(words / 200));
  const candidates = [1, 2, 3, 4, 5, 6, 8, 10];
  const closest = candidates.reduce((prev, curr) => 
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );
  return `${closest} min`;
}

function stripToAllowedHtml(html, allowedUrls) {
  if (!html) return "";
  const linksAllowed = Array.isArray(allowedUrls);
  const urlSet = linksAllowed ? new Set(allowedUrls) : null;

  let sanitized = html;

  // 1. <a>...</a>: keep only if links are allowed AND href is in the real-URL whitelist; else unwrap to text.
  sanitized = sanitized.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, content) => {
    if (!linksAllowed) return content;
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    if (hrefMatch && urlSet.has(hrefMatch[1])) {
      return `<a href="${hrefMatch[1]}">${content}</a>`;
    }
    return content; // hallucinated / non-whitelisted link -> unwrap
  });

  // 2. Strip attributes from allowed tags; remove disallowed tags (keep inner text).
  sanitized = sanitized.replace(/<(\/?[a-zA-Z0-9]+)([^>]*)>/g, (match, tagNameWithSlash, attrs) => {
    const isClosing = tagNameWithSlash.startsWith("/");
    const tagName = (isClosing ? tagNameWithSlash.slice(1) : tagNameWithSlash).toLowerCase();
    const allowedTags = ["p", "h2", "h3", "strong", "em", "ul", "ol", "li", "blockquote", "a", "br"];
    if (!allowedTags.includes(tagName)) return "";
    if (isClosing) return `</${tagName}>`;
    if (tagName === "a") {
      const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
      if (hrefMatch) return `<a href="${hrefMatch[1]}">`;
      return "";
    }
    if (tagName === "br") return "<br>";
    return `<${tagName}>`;
  });

  return sanitized;
}

async function generateArticle(req, res) {
  try {
    const { template, topic } = req.body;
    const { businessId } = req.user;

    if (!template) {
      return res.status(400).json({ error: "Șablonul este obligatoriu." });
    }

    const allowedTemplates = ["diesel_vs_benzina", "prima_inmatriculare_de", "top_suv_stoc", "subiect_liber"];
    if (!allowedTemplates.includes(template)) {
      return res.status(400).json({ error: "Șablon invalid." });
    }

    if (template === "subiect_liber" && (!topic || !topic.trim())) {
      return res.status(400).json({ error: "Subiectul este obligatoriu pentru subiect liber." });
    }

    let prompt = "";
    let carList = [];

    if (template === "diesel_vs_benzina") {
      prompt = "Scrie un articol de blog detaliat în care compari motoarele Diesel cu cele pe Benzină, evidențiind avantajele și dezavantajele fiecăruia pentru cumpărătorii din România. Nu folosi stoc auto.";
    } else if (template === "prima_inmatriculare_de") {
      prompt = "Scrie un ghid pas cu pas despre procesul și costurile de primă înmatriculare în România a unei mașini rulate importate din Germania. Nu folosi stoc auto.";
    } else if (template === "top_suv_stoc") {
      const listings = await prisma.listing.findMany({
        where: { businessId, status: "AVAILABLE", bodyType: "SUV" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { make: true, model: true }
      });

      carList = listings.map(l => ({
        title: l.title,
        make: l.make ? l.make.name : "",
        model: l.model ? l.model.name : "",
        year: l.year,
        price: l.price,
        mileage: l.mileage,
        fuelType: FUEL[l.fuelType] || l.fuelType,
        url: `/stoc/${l.slug || l.id}`
      }));

      if (carList.length < 3) {
        return res.status(400).json({ error: "Stoc insuficient de SUV-uri pentru acest articol (minim 3). Adaugă mai multe anunțuri SUV disponibile." });
      }

      prompt = `Scrie un articol de recomandări care prezintă o selecție de SUV-uri excelente din stocul nostru actual. Prezintă exclusiv următoarele mașini din stoc:\n${JSON.stringify(carList, null, 2)}\n\nPentru fiecare dintre mașinile descrise, creează obligatoriu un link intern de tipul <a href="URL-ul_mașinii">Vezi oferta</a> folosind exact URL-ul indicat în obiectul mașinii respective. Nu inventa alte mașini, alte prețuri sau alte legături web. IMPORTANT despre preț: valorile din câmpul "price" sunt exprimate în EURO (€). Când menționezi un preț în articol, scrie-l explicit în euro (ex. "24.900 €" sau "24.900 EUR"). Nu converti în lei și nu presupune altă monedă. Dacă o mașină nu are preț, nu inventa unul.`;
    } else if (template === "subiect_liber") {
      prompt = `Scrie un articol de blog despre următorul subiect propus de utilizator: "${topic}". Alege cea mai potrivită categorie dintre cele 7 disponibile și returneaz-o în categoryKey.`;
    }

    const raw = await generateText({ systemInstruction: SYSTEM_INSTRUCTION_ARTICLE, prompt, maxOutputTokens: 4096, responseMimeType: "application/json" });
    
    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```(json)?\n?/, "");
      cleanRaw = cleanRaw.replace(/\n?```$/, "");
      cleanRaw = cleanRaw.trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanRaw);
    } catch (e) {
      console.error("Failed to parse AI article raw response:", raw);
      console.error(e);
      return res.status(502).json({ error: "Generarea a eșuat (răspuns invalid). Încearcă din nou." });
    }

    let categoryKey = "";
    if (template === "diesel_vs_benzina") {
      categoryKey = "tehnic";
    } else if (template === "prima_inmatriculare_de") {
      categoryKey = "ghid";
    } else if (template === "top_suv_stoc") {
      categoryKey = "top";
    } else if (template === "subiect_liber") {
      const allowedKeys = ["ghid", "tehnic", "top", "legal", "vanzare", "noutati", "general"];
      categoryKey = parsed.categoryKey;
      if (!categoryKey || !allowedKeys.includes(categoryKey)) {
        categoryKey = "general";
      }
    }

    const CATEGORY_MAP = {
      ghid: "Ghid cumpărare",
      tehnic: "Tehnic",
      top: "Top & Recomandări",
      legal: "Legal & Financiar",
      vanzare: "Ghid vânzare",
      noutati: "Noutăți",
      general: "General"
    };

    const category = CATEGORY_MAP[categoryKey];
    const allowedUrls = template === "top_suv_stoc" ? carList.map(c => c.url) : null;
    const content = stripToAllowedHtml(parsed.content || "", allowedUrls);
    const readTime = calcReadTime(content);

    res.json({
      title: parsed.title || "",
      excerpt: parsed.excerpt || "",
      content,
      category,
      categoryKey,
      readTime
    });
  } catch (error) {
    console.error("[Gemini API Error]", error);
    if (error.message && error.message.includes("GEMINI_API_KEY is not set")) {
      return res.status(500).json({ error: "Serviciul AI nu este configurat (lipsește cheia)." });
    }
    return res.status(502).json({ error: "Generarea a eșuat. Încearcă din nou." });
  }
}

const SYSTEM_INSTRUCTION_TOPICS = "Ești un strateg de conținut pentru blogul unui dealer auto din România. Propui idei de titluri de articole de blog, relevante și utile pentru cumpărători de mașini rulate. Returnezi EXCLUSIV un obiect JSON valid, fără markdown, de forma {\"suggestions\": [\"titlu 1\", \"titlu 2\", ...]}. Fiecare titlu: în română corectă cu diacritice, concret, între 6 și 12 cuvinte, fără ghilimele în interior.\n\nREGULI STRICTE DESPRE MĂRCI:\n- Ai voie să menționezi mărci auto DOAR dacă apar în lista de mărci disponibile furnizată în prompt. Este INTERZIS să menționezi orice altă marcă sau model care nu se află în acea listă (ex: nu inventa Dacia, Skoda, Ford, Mercedes etc. dacă nu sunt în listă).\n- Ideile GENERALE (evergreen) NU trebuie să conțină NICIO marcă sau model specific. Ele rămân la concepte universale (ex: cum alegi o mașină rulată, verificarea istoricului, finanțare, costuri de întreținere).\n- Doar ideile ANCORATE pe stoc pot conține mărci, și DOAR din lista furnizată.";

async function suggestTopics(req, res) {
  try {
    const { businessId } = req.user;

    const listings = await prisma.listing.findMany({
      where: { businessId, status: "AVAILABLE" },
      take: 40,
      include: { make: true, model: true }
    });

    const uniqueMakes = [...new Set(listings.map(l => l.make ? l.make.name : "").filter(name => name))].slice(0, 8);
    const bodyTypeMap = {
      SUV: "SUV",
      SEDAN: "Berline",
      HATCHBACK: "Hatchback-uri",
      BREAK: "Break-uri",
      COUPE: "Coupé-uri",
      CABRIO: "Cabrio",
      MONOVOLUM: "Monovolume",
      VAN: "Van-uri",
      PICKUP: "Pick-up-uri"
    };
    const uniqueBodyTypes = [...new Set(listings.map(l => bodyTypeMap[l.bodyType]).filter(label => label))];
    const count = listings.length;
    const brandWhitelist = uniqueMakes;

    let prompt = "";
    if (count > 0 && brandWhitelist.length > 0) {
      prompt = `Propune exact 6 idei de titluri.\n\n3 idei GENERALE (evergreen) — fără nicio marcă menționată, doar concepte universale despre mașini rulate.\n\n3 idei ANCORATE pe stoc — pot menționa DOAR aceste mărci disponibile: ${brandWhitelist.join(", ")}. Tipuri de caroserie în stoc: ${uniqueBodyTypes.join(", ")}. Nu menționa nicio altă marcă în afara listei.`;
    } else {
      prompt = `Propune exact 6 idei de titluri de articole GENERALE (evergreen), utile oricărui dealer auto de mașini rulate din România. Nu face referire la un stoc specific.`;
    }

    const raw = await generateText({
      systemInstruction: SYSTEM_INSTRUCTION_TOPICS,
      prompt,
      maxOutputTokens: 1024,
      responseMimeType: "application/json"
    });

    let cleanRaw = raw.trim();
    if (cleanRaw.startsWith("```")) {
      cleanRaw = cleanRaw.replace(/^```(json)?\n?/, "");
      cleanRaw = cleanRaw.replace(/\n?```$/, "");
      cleanRaw = cleanRaw.trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanRaw);
    } catch (e) {
      console.error("Failed to parse AI suggestions raw response:", raw);
      console.error(e);
      return res.status(502).json({ error: "Nu s-au putut genera sugestii. Încearcă din nou." });
    }

    let suggestions = parsed.suggestions;
    if (!Array.isArray(suggestions)) {
      console.error("AI suggestions did not return an array:", parsed);
      return res.status(502).json({ error: "Nu s-au putut genera sugestii. Încearcă din nou." });
    }

    suggestions = suggestions.filter(s => typeof s === "string" && s.trim()).map(s => s.trim());

    // Deterministic backend filter (safety net)
    const KNOWN_BRANDS = ["Dacia","Renault","Volkswagen","BMW","Audi","Mercedes","Mercedes-Benz","Skoda","Ford","Opel","Toyota","Honda","Nissan","Mazda","Hyundai","Kia","Peugeot","Citroen","Citroën","Fiat","Seat","Volvo","Tesla","Porsche","Jaguar","Land Rover","Range Rover","Mini","Suzuki","Mitsubishi","Chevrolet","Jeep","Dodge","Alfa Romeo","Lexus","Infiniti","Cupra","DS","Smart","Lancia","Saab","Chrysler"];
    const allowedLower = new Set(brandWhitelist.map(b => b.toLowerCase()));

    const filteredSuggestions = [];
    for (const s of suggestions) {
      let shouldDrop = false;
      for (const brand of KNOWN_BRANDS) {
        const brandLower = brand.toLowerCase();
        const escapedBrand = brandLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(?:^|[^a-zA-Z0-9ăâîșțĂÂÎȘȚ])${escapedBrand}(?:$|[^a-zA-Z0-9ăâîșțĂÂÎȘȚ])`, 'i');
        
        if (regex.test(s)) {
          if (!allowedLower.has(brandLower)) {
            shouldDrop = true;
            break;
          }
        }
      }
      
      if (shouldDrop) {
        console.warn("[suggest-topics] dropped hallucinated suggestion:", s);
      } else {
        filteredSuggestions.push(s);
      }
    }

    suggestions = filteredSuggestions.slice(0, 6);

    if (suggestions.length === 0) {
      return res.status(502).json({ error: "Nu s-au putut genera sugestii. Încearcă din nou." });
    }

    res.json({ suggestions });
  } catch (error) {
    console.error("[Gemini API Error]", error);
    if (error.message && error.message.includes("GEMINI_API_KEY is not set")) {
      return res.status(500).json({ error: "Serviciul AI nu este configurat (lipsește cheia)." });
    }
    return res.status(502).json({ error: "Nu s-au putut genera sugestii. Încearcă din nou." });
  }
}

async function diagnoseListing(req, res) {
  try {
    const { businessId } = req.user;
    const { listingId } = req.params;

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      }
    });

    if (!listing) {
      return res.status(404).json({ error: "Anunțul nu a fost găsit." });
    }

    const now = new Date();
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

    const myViews30 = await prisma.view.count({
      where: {
        listingId,
        viewedAt: { gte: date30DaysAgo }
      }
    });

    const totalBusinessViews30 = await prisma.view.count({
      where: {
        businessId,
        viewedAt: { gte: date30DaysAgo }
      }
    });

    const stockSize = await prisma.listing.count({
      where: {
        businessId,
        status: "AVAILABLE"
      }
    });

    const avgViews30 = stockSize > 0 ? (totalBusinessViews30 / stockSize) : 0;

    const myLeads = await prisma.message.count({
      where: {
        listingId
      }
    });

    const daysOnStock = Math.floor((now - new Date(listing.createdAt)) / (1000 * 60 * 60 * 24));

    let verdictCode = "HEALTHY";

    if (stockSize < DIAG_MIN_STOCK || totalBusinessViews30 === 0) {
      verdictCode = "INSUFFICIENT_DATA";
    } else if (daysOnStock < DIAG_TOO_NEW_DAYS) {
      verdictCode = "TOO_NEW";
    } else if (myViews30 >= DIAG_HIGH_VIEWS_MULT * avgViews30 && myLeads === 0) {
      verdictCode = "HIGH_VIEWS_NO_LEADS";
    } else if (myViews30 <= DIAG_LOW_VIEWS_MULT * avgViews30) {
      verdictCode = "LOW_VIEWS";
    } else if (daysOnStock >= DIAG_STALE_DAYS) {
      verdictCode = "STALE_NORMAL_TRAFFIC";
    }

    const featureIds = listing.features ? listing.features.map(f => f.id) : [];
    const specInput = {
      ...listing,
      featureIds
    };
    const spec = await buildListingSpec(specInput);

    let fallbackObj = { explanation: "", tips: [] };
    switch (verdictCode) {
      case "INSUFFICIENT_DATA":
        fallbackObj = {
          explanation: "Nu există suficiente date pentru a genera o diagnoză. Stocul este prea mic sau anunțurile nu au vizualizări.",
          tips: ["Adăugați mai multe anunțuri în platformă", "Promovați anunțurile existente pentru a atrage trafic"]
        };
        break;
      case "TOO_NEW":
        fallbackObj = {
          explanation: "Anunțul este prea nou pentru a trage concluzii relevante.",
          tips: ["Așteptați câteva zile pentru a acumula statistici", "Promovați anunțul pentru a grăbi colectarea de vizualizări"]
        };
        break;
      case "HIGH_VIEWS_NO_LEADS":
        fallbackObj = {
          explanation: "Anunțul atrage atenția cumpărătorilor (are multe vizualizări), dar nu generează mesaje sau contacte.",
          tips: ["Verificați prețul în comparație cu piața", "Adăugați fotografii de o calitate mai bună"]
        };
        break;
      case "LOW_VIEWS":
        fallbackObj = {
          explanation: "Anunțul are un nivel de vizualizări redus, mult sub media stocului curent.",
          tips: ["Îmbunătățiți titlul anunțului cu detalii atractive", "Promovați anunțul pe alte platforme auto", "Verificați vizibilitatea pe portalurile auto"]
        };
        break;
      case "STALE_NORMAL_TRAFFIC":
        fallbackObj = {
          explanation: "Mașina înregistrează un trafic normal, dar se află pe stoc de peste 45 de zile fără finalizare.",
          tips: ["Scădeți ușor prețul cu 2-3%", "Reîmprospătați descrierea sau ordinea pozelor"]
        };
        break;
      case "HEALTHY":
      default:
        fallbackObj = {
          explanation: "Anunțul tău performează în parametri optimi. Traficul și mesajele sunt aliniate cu media stocului.",
          tips: ["Mențineți anunțul activ fără modificări majore", "Verificați prețul periodic față de concurență"]
        };
        break;
    }

    const systemInstruction = `Ești un asistent de vânzări auto specializat în mașini rulate în România. Analizezi performanța unui anunț auto.
Primești un cod de diagnostic (verdictCode), metricile de trafic ale anunțului și detaliile mașinii (specificațiile).
Sarcina ta este să returnezi EXCLUSIV un obiect JSON valid (fără formatare markdown, fără backticks) de forma:
{
  "explanation": "1-2 propoziții simple, limbaj extrem de simplu pe înțelesul unui dealer fără cunoștințe tehnice, explicând ce se întâmplă cu anunțul",
  "tips": ["sfat 1", "sfat 2"] // 1-3 sfaturi concrete scurte, acționabile, la modul imperativ (ex: "Adaugă poze mai clare", "Scade prețul cu 3-5%")
}

REGULI CRITICE:
- Folosește un ton cald, profesionist și adresează-te la persoana a doua (ex: „Anunțul tău...”, „Îți recomandăm...”).
- NU schimba, NU contrazice și NU trece peste diagnosticul deja decis (verdictCode).
- Folosește strict cifrele/metricile transmise în prompt. Nu inventa alte numere, vizualizări sau date istorice.
- FĂRĂ emoji-uri și FĂRĂ formatare markdown în texte. Fiecare sfat/tip trebuie să aibă maximum 8 cuvinte.
- Limba română corectă, cu diacritice.

Ghidaj în funcție de verdictCode pentru explanation și tips:
1. INSUFFICIENT_DATA: Spune clar că nu sunt destule date în stoc sau vizualizări pentru concluzii. Nu inventa o problemă. Sfatul să fie de a adăuga mai multe anunțuri sau de a le promova.
2. TOO_NEW: Spune că anunțul este proaspăt adăugat (sub 7 zile) și trebuie lăsat să acumuleze trafic. Sfatul să fie de a aștepta câteva zile sau de a aduce trafic.
3. HIGH_VIEWS_NO_LEADS: Explică faptul că mașina atrage atenția (are multe vizualizări), dar nu generează contacte. Recomandă verificarea prețului comparativ cu piața sau îmbunătățirea pozelor/descrierii.
4. LOW_VIEWS: Explică faptul că traficul este redus sub media stocului. Recomandă optimizarea titlului, verificarea vizibilității sau promovarea anunțului.
5. STALE_NORMAL_TRAFFIC: Menționează că mașina are trafic normal dar stă de mult pe stoc (peste 45 de zile). Sugerează o ușoară reducere de preț sau actualizarea anunțului.
6. HEALTHY: Felicită dealerul pentru că anunțul este în parametri optimi. Menționează că are un comportament sănătos în ceea ce privește vizualizările și mesajele.`;

    const prompt = `Cod diagnostic (verdictCode): ${verdictCode}
Metrici:
- Vizualizări anunț (ultimele 30 zile): ${myViews30}
- Media vizualizărilor pe stoc (ultimele 30 zile): ${avgViews30.toFixed(1)}
- Mesaje/lead-uri primite (all-time): ${myLeads}
- Zile pe stoc: ${daysOnStock}
- Dimensiune stoc disponibil: ${stockSize}

Specificații mașină:
${spec || "Fără specificații disponibile."}`;

    let explanation = fallbackObj.explanation;
    let tips = fallbackObj.tips;
    let source = "fallback";

    try {
      const response = await generateText({
        systemInstruction,
        prompt,
        maxOutputTokens: 512,
        responseMimeType: "application/json"
      });
      if (response && response.trim()) {
        let cleanRaw = response.trim();
        if (cleanRaw.startsWith("```")) {
          cleanRaw = cleanRaw.replace(/^```(json)?\n?/, "");
          cleanRaw = cleanRaw.replace(/\n?```$/, "");
          cleanRaw = cleanRaw.trim();
        }
        const parsed = JSON.parse(cleanRaw);
        if (parsed && typeof parsed.explanation === "string" && parsed.explanation.trim() && Array.isArray(parsed.tips)) {
          explanation = parsed.explanation.trim();
          tips = parsed.tips.filter(t => typeof t === "string" && t.trim()).map(t => t.trim());
          source = "ai";
        }
      }
    } catch (geminiError) {
      console.error("[Diagnose Gemini Error]", geminiError.message || geminiError);
    }

    let level = "warn";
    if (verdictCode === "HEALTHY") {
      level = "good";
    } else if (verdictCode === "LOW_VIEWS") {
      level = "bad";
    }

    let verdict = "De îmbunătățit";
    let subtitle = "Câteva lucruri de reglat";

    if (level === "good") {
      verdict = "Se vinde bine";
      subtitle = "Anunțul e sănătos";
    } else if (level === "bad") {
      verdict = "Nu se vinde";
      subtitle = "Are nevoie de atenție";
    }

    res.json({
      verdictCode,
      level,
      verdict,
      subtitle,
      explanation,
      tips,
      source,
      metrics: {
        myViews30,
        avgViews30: Number(avgViews30.toFixed(2)),
        myLeads,
        daysOnStock,
        stockSize
      }
    });

  } catch (error) {
    console.error("[diagnoseListing Error]", error);
    return res.status(502).json({ error: "Diagnoza a eșuat. Încearcă din nou." });
  }
}


function getPriceLine(price) {
  if (price === undefined || price === null || price === "") return "";
  const val = Number(price);
  if (isNaN(val) || val <= 0) return "";
  return `Preț: ${val.toLocaleString("ro-RO")} €`;
}

const MKT_FACEBOOK = `Ești un copywriter specializat în anunțuri auto pentru un dealer de mașini rulate din România. Scrie o postare de Facebook pentru mașina primită.
Postarea trebuie să fie caldă, antrenantă și ușor de citit (scannable).
Folosește un număr redus de emoji-uri (2-4 emoji-uri de bun gust, de exemplu: 🚗📍✅).
Adaugă câteva hashtag-uri relevante la sfârșit.
Include un îndemn clar la acțiune ("Sună-ne / Scrie-ne pentru detalii").
Dacă prețul este furnizat, menționează-l în euro.
Postarea trebuie să aibă 2-3 paragrafe scurte.
FĂRĂ formatare markdown.
Folosește EXCLUSIV informațiile din specificația primită. Nu inventa dotări, istoric, garanții, prețuri sau caracteristici. Scrie în română corectă cu diacritice. REGULĂ IMPORTANTĂ DESPRE LOCAȚIE: NU inventa și NU include hashtag-uri sau mențiuni de localitate, oraș, județ sau zonă geografică (ex: #Bucuresti, #Cluj, 'în București'). Locația NU este furnizată în date. Hashtag-urile trebuie să se refere DOAR la marcă, model, tip de caroserie, combustibil și caracteristici reale din specificație.`;

const MKT_WHATSAPP = `Ești un copywriter specializat în anunțuri auto pentru un dealer de mașini rulate din România. Scrie un mesaj scurt de WhatsApp pentru a fi trimis unui client interesat.
Mesajul trebuie să fie direct, prietenos și concis (maximum 3-5 linii).
Începe direct cu marca, modelul, anul de fabricație și rulajul (km).
Prezintă punctele forte cheie ale mașinii.
Dacă prețul este furnizat, menționează-l în euro.
Încheie cu o invitație de a răspunde sau de a suna.
Folosește un număr minim sau deloc de emoji-uri. Fără hashtag-uri.
FĂRĂ formatare markdown.
Folosește EXCLUSIV informațiile din specificația primită. Nu inventa dotări, istoric, garanții, prețuri sau caracteristici. Scrie în română corectă cu diacritice.`;

const MKT_OLX = `Ești un copywriter specializat în anunțuri auto pentru un dealer de mașini rulate din România. Scrie un anunț de tip OLX.
Începe cu un titlu scurt și atractiv.
Apoi oferă o descriere factuală și concisă, concentrată pe specificațiile pe care le caută un cumpărător (an, km, motor, cutie de viteze, stare).
Dacă prețul este furnizat, menționează-l în euro.
Fără emoji-uri, fără hashtag-uri. Text simplu, sobru și de încredere.
FĂRĂ formatare markdown.
Folosește EXCLUSIV informațiile din specificația primită. Nu inventa dotări, istoric, garanții, prețuri sau caracteristici. Scrie în română corectă cu diacritice.`;

const MKT_INSTAGRAM = `Ești un copywriter specializat în anunțuri auto pentru un dealer de mașini rulate din România. Scrie o descriere (caption) de Instagram pentru mașina primită.
Stilul trebuie să fie vizual, axat pe lifestyle și cu o primă linie de impact (punchy).
Folosește emoji-uri cu gust.
Dacă prețul este furnizat, menționarea lui este opțională (în euro).
Adaugă la sfârșit un bloc de hashtag-uri relevante (între 8 și 15 hashtag-uri, amestecând hashtag-uri auto generale cu detalii specifice ale mașinii).
FĂRĂ formatare markdown.
Folosește EXCLUSIV informațiile din specificația primită. Nu inventa dotări, istoric, garanții, prețuri sau caracteristici. Scrie în română corectă cu diacritice. REGULĂ IMPORTANTĂ DESPRE LOCAȚIE: NU inventa și NU include hashtag-uri sau mențiuni de localitate, oraș, județ sau zonă geografică (ex: #Bucuresti, #Cluj, 'în București'). Locația NU este furnizată în date. Hashtag-urile trebuie să se refere DOAR la marcă, model, tip de caroserie, combustibil și caracteristici reale din specificație.`;

async function generateMarketing(req, res) {
  try {
    const { format, listingId } = req.body;
    const allowedFormats = ["facebook", "whatsapp", "olx", "instagram"];
    if (!format || !allowedFormats.includes(format)) {
      return res.status(400).json({ error: "Format invalid." });
    }

    let spec;
    let priceToUse;

    if (listingId) {
      const { businessId } = req.user;
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, businessId },
        include: {
          make: true,
          model: true,
          features: true
        }
      });

      if (!listing) {
        return res.status(404).json({ error: "Anunțul nu a fost găsit." });
      }

      const featureIds = listing.features ? listing.features.map(f => f.id) : [];
      const specInput = {
        ...listing,
        featureIds
      };
      spec = await buildListingSpec(specInput);
      priceToUse = listing.price;
    } else {
      spec = await buildListingSpec(req.body);
      priceToUse = req.body.price;
    }

    if (!spec) {
      return res.status(400).json({ error: "Date insuficiente. Completează măcar marca, modelul și anul." });
    }

    const priceLine = getPriceLine(priceToUse);
    let specWithPrice = spec;
    if (priceLine) {
      const priceVal = Number(priceToUse);
      const formatted = priceVal.toLocaleString("ro-RO");
      specWithPrice = spec + "\nPreț public: " + formatted + " €";
    }

    let systemInstruction = "";
    switch (format) {
      case "facebook":
        systemInstruction = MKT_FACEBOOK;
        break;
      case "whatsapp":
        systemInstruction = MKT_WHATSAPP;
        break;
      case "olx":
        systemInstruction = MKT_OLX;
        break;
      case "instagram":
        systemInstruction = MKT_INSTAGRAM;
        break;
    }

    const prompt = "Generează textul pentru următoarea mașină:\n\n" + specWithPrice;
    const result = await generateText({
      systemInstruction,
      prompt,
      maxOutputTokens: 1024,
      temperature: 0.8
    });

    res.json({ format, text: result.trim() });
  } catch (error) {
    console.error("[Gemini API Error]", error);
    if (error.message && error.message.includes("GEMINI_API_KEY is not set")) {
      return res.status(500).json({ error: "Serviciul AI nu este configurat (lipsește cheia)." });
    }
    return res.status(502).json({ error: "Generarea a eșuat. Încearcă din nou." });
  }
}

module.exports = {
  generateDescription,
  generateArticle,
  suggestTopics,
  buildListingSpec,
  diagnoseListing,
  generateMarketing
};


