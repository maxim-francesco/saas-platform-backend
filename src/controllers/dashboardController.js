// src/controllers/dashboardController.js
const prisma = require("../config/prismaClient");
const { generateText } = require("../services/geminiService");

// cache in-memory pentru rezumatul săptămânal: `${businessId}:${YYYY-MM-DD}` -> payload
const weeklySummaryCache = new Map();

const getStats = async (req, res) => {
  const { businessId } = req.user;

  // --- ✅ PAS DE DEPANARE #1 ---
  // Verificăm dacă primim corect ID-ul de business din token.
  console.log(
    `[DEBUG] Se preiau statisticile pentru businessId: ${businessId}`
  );
  if (!businessId) {
    console.error(
      "[DEBUG] EROARE CRITICĂ: businessId este undefined în req.user!"
    );
    // Oprim execuția dacă ID-ul lipsește, pentru a nu avea rezultate false.
    return res
      .status(400)
      .json({ message: "ID-ul de business lipsește din token." });
  }
  // --- SFÂRȘIT PAS DE DEPANARE ---

  try {
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

    const distinctMakes = await prisma.listing.groupBy({
      by: ['makeId'],
      where: { businessId, makeId: { not: null } }
    });
    const categoryCount = distinctMakes.length;

    const [
      listingCount,
      totalMessageCount,
      totalViews,
      viewsLast30Days,
    ] = await prisma.$transaction([
      prisma.listing.count({ where: { businessId } }),
      prisma.message.count({ where: { businessId } }),
      prisma.view.count({ where: { businessId } }),
      prisma.view.count({
        where: { businessId, viewedAt: { gte: date30DaysAgo } },
      }),
    ]);

    // --- ✅ PAS DE DEPANARE #2 ---
    // Verificăm ce rezultate primim direct din baza de date.
    console.log(
      `[DEBUG] Rezultate din DB: listings=${listingCount}, distinctMakes=${categoryCount}, messages=${totalMessageCount}, views=${totalViews}`
    );
    // --- SFÂRȘIT PAS DE DEPANARE ---

    res.status(200).json({
      totalListings: listingCount,
      totalCategories: categoryCount,
      totalMessages: totalMessageCount, // Câmp re-adăugat
      totalViews: totalViews,
      viewsLast30Days: viewsLast30Days,
    });
  } catch (error) {
    console.error("[DEBUG] A apărut o eroare în getStats:", error);
    res.status(500).json({ message: "Eroare la preluarea statisticilor." });
  }
};

// --- FUNCȚIE NOUĂ ADĂUGATĂ ---
const getListingAnalytics = async (req, res) => {
  const { businessId } = req.user;

  try {
    // 1. Găsim Top 5 cele mai vizualizate anunțuri ACTIVE
    const mostViewed = await prisma.listing.findMany({
      where: {
        businessId,
        status: "AVAILABLE", // Ne interesează doar anunțurile active
      },
      include: {
        _count: { select: { views: true } }, // Numărăm vizualizările
        images: {
          // Includem prima imagine pentru afișare în UI
          select: { url: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
      orderBy: {
        views: { _count: "desc" }, // Sortăm descrescător după numărul de vizualizări
      },
      take: 5, // Luăm doar primele 5
    });

    // 2. Găsim Top 5 cele mai PUȚIN vizualizate anunțuri ACTIVE
    const leastViewed = await prisma.listing.findMany({
      where: {
        businessId,
        status: "AVAILABLE",
      },
      include: {
        _count: { select: { views: true } },
        images: {
          select: { url: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
      orderBy: {
        views: { _count: "asc" }, // Sortăm crescător
      },
      take: 5,
    });

    res.status(200).json({ mostViewed, leastViewed });
  } catch (error) {
    console.error("[DEBUG] A apărut o eroare în getListingAnalytics:", error);
    res
      .status(500)
      .json({ message: "Eroare la preluarea statisticilor pentru anunțuri." });
  }
};

// --- FUNCȚIE NOUĂ: Date pentru Grafic ---
const getViewsChart = async (req, res) => {
  const { businessId } = req.user;

  try {
    // 1. Calculăm data de acum 7 zile
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6); // Luăm ultimele 7 zile (inclusiv azi)
    sevenDaysAgo.setHours(0, 0, 0, 0); // Resetăm ora la începutul zilei

    // 2. Extragem vizualizările brute din baza de date
    const views = await prisma.view.findMany({
      where: {
        businessId: businessId,
        viewedAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        viewedAt: true,
      },
    });

    // 3. Procesăm datele în JavaScript pentru a umple zilele lipsă (cu 0)
    // Creăm un map pentru ultimele 7 zile, inițializat cu 0
    const statsMap = new Map();
    const displayData = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateKey = d.toISOString().split("T")[0]; // Format YYYY-MM-DD
      statsMap.set(dateKey, 0);
    }

    // Numărăm vizualizările reale
    views.forEach((view) => {
      const dateKey = view.viewedAt.toISOString().split("T")[0];
      if (statsMap.has(dateKey)) {
        statsMap.set(dateKey, statsMap.get(dateKey) + 1);
      }
    });

    // Transformăm Map-ul în array-ul final pentru Recharts
    // Vom trimite data ca timestamp sau string ISO, frontend-ul o va formata (Luni, Marți etc.)
    statsMap.forEach((count, date) => {
      displayData.push({
        date: date, // YYYY-MM-DD
        views: count,
      });
    });

    res.status(200).json(displayData);
  } catch (error) {
    console.error("Eroare la generarea graficului:", error);
    res.status(500).json({ message: "Eroare la preluarea datelor pentru grafic." });
  }
};

// --- #4: Rezumat săptămână în limbaj natural ---
const buildWeeklySummaryFallback = (f) => {
  const parts = [];
  const deltaTxt =
    f.viewsDeltaPct === null
      ? ""
      : f.viewsDeltaPct >= 0
      ? ` (+${f.viewsDeltaPct}%)`
      : ` (${f.viewsDeltaPct}%)`;
  parts.push(
    `Săptămâna aceasta: ${f.viewsThisWeek} vizualizări${deltaTxt}, ${f.newLeadsThisWeek} lead-uri noi` +
      (f.newLeadsThisWeek > 0 ? ` din care ${f.uncontactedLeads} necontactate.` : `.`)
  );
  if (f.topListing) {
    parts.push(
      `Cel mai văzut anunț: ${f.topListing.title} (${f.topListing.views} vizualizări, ${f.topListing.leads} lead-uri).`
    );
  }
  if (f.staleCount > 0) {
    parts.push(`${f.staleCount} mașini sunt de peste 45 de zile în platformă.`);
  }
  return parts.join(" ");
};

const getWeeklySummary = async (req, res) => {
  const { businessId } = req.user;
  if (!businessId) {
    return res.status(400).json({ message: "ID-ul de business lipsește din token." });
  }
  try {
    const forceRefresh = req.query.refresh === "1";
    const todayKey = new Date().toISOString().split("T")[0];
    const cacheKey = `${businessId}:${todayKey}`;

    if (!forceRefresh && weeklySummaryCache.has(cacheKey)) {
      return res.status(200).json(weeklySummaryCache.get(cacheKey));
    }

    // Ferestre rolling de 7 zile (consecvent cu restul dashboard-ului). Comparație de instant, fără bucketing pe dată.
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(now.getDate() - 45);

    const [viewsThisWeek, viewsLastWeek, newLeadsThisWeek, uncontactedLeads, staleCount] =
      await prisma.$transaction([
        prisma.view.count({ where: { businessId, viewedAt: { gte: sevenDaysAgo } } }),
        prisma.view.count({
          where: { businessId, viewedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        }),
        prisma.message.count({ where: { businessId, createdAt: { gte: sevenDaysAgo } } }),
        prisma.message.count({
          where: { businessId, createdAt: { gte: sevenDaysAgo }, status: "NEW" },
        }),
        prisma.listing.count({
          where: { businessId, status: "AVAILABLE", createdAt: { lte: fortyFiveDaysAgo } },
        }),
      ]);

    // Cel mai văzut anunț în ultimele 7 zile
    const topViewGroups = await prisma.view.groupBy({
      by: ["listingId"],
      where: { businessId, viewedAt: { gte: sevenDaysAgo }, listingId: { not: null } },
      _count: { listingId: true },
      orderBy: { _count: { listingId: "desc" } },
      take: 1,
    });

    let topListing = null;
    if (topViewGroups.length > 0 && topViewGroups[0].listingId) {
      const lid = topViewGroups[0].listingId;
      const [listing, leadsForListing] = await prisma.$transaction([
        prisma.listing.findUnique({ where: { id: lid }, select: { title: true } }),
        prisma.message.count({
          where: { businessId, listingId: lid, createdAt: { gte: sevenDaysAgo } },
        }),
      ]);
      if (listing) {
        topListing = {
          title: listing.title,
          views: topViewGroups[0]._count.listingId,
          leads: leadsForListing,
        };
      }
    }

    // % delta views, fără împărțire la zero și fără procente înșelătoare de la 0
    let viewsDeltaPct = null;
    if (viewsLastWeek > 0) {
      viewsDeltaPct = Math.round(((viewsThisWeek - viewsLastWeek) / viewsLastWeek) * 100);
    }

    const facts = {
      viewsThisWeek,
      viewsLastWeek,
      viewsDeltaPct,
      newLeadsThisWeek,
      uncontactedLeads,
      staleCount,
      topListing,
    };

    const fallbackText = buildWeeklySummaryFallback(facts);

    // Formulare umană via Gemini — primește DOAR faptele deja calculate, nu DB brut
    let summaryText = fallbackText;
    let source = "fallback";
    try {
      const systemInstruction =
        "Ești asistentul unui dealer auto din România. Primești un obiect JSON cu cifre REALE despre ultima săptămână de activitate de pe site-ul dealerului. " +
        "Scrie un rezumat SCURT (2-3 propoziții), în limba română, ton cald și profesional, adresare la persoana a doua ('ai', 'tău'). " +
        "\n\nSEMNIFICAȚIA EXACTĂ A CÂMPURILOR (respectă-le strict, nu confunda un câmp cu altul):\n" +
        "- viewsThisWeek = numărul de vizualizări ale anunțurilor în ULTIMELE 7 ZILE.\n" +
        "- viewsLastWeek = vizualizări în săptămâna ANTERIOARĂ (zilele 8-14 în urmă), doar pentru comparație.\n" +
        "- viewsDeltaPct = variația procentuală a vizualizărilor față de săptămâna trecută (poate fi null dacă nu există bază de comparație — atunci NU menționa procent).\n" +
        "- newLeadsThisWeek = numărul de LEAD-URI (clienți care au trimis mesaj) în ultimele 7 zile.\n" +
        "- uncontactedLeads = câte dintre lead-urile noi sunt încă NECONTACTATE.\n" +
        "- staleCount = numărul de MAȘINI (anunțuri) care stau de peste 45 de zile în platformă. ACESTEA SUNT MAȘINI, NU LEAD-URI. Nu le descrie niciodată ca lead-uri.\n" +
        "- topListing = cel mai vizualizat anunț din săptămână (title = numele mașinii, views = vizualizări, leads = lead-uri generate de acel anunț). Dacă e null, nu există date și nu inventa o mașină.\n" +
        "\nREGULI STRICTE:\n" +
        "- Folosește DOAR cifrele din JSON. NU inventa numere, procente, nume de mașini sau concluzii care nu rezultă din date.\n" +
        "- NU confunda mașinile (staleCount, topListing) cu lead-urile (newLeadsThisWeek, uncontactedLeads). Sunt lucruri diferite.\n" +
        "- Dacă un câmp e null sau 0, nu-l inventa și nu-l comenta forțat. Excepție: dacă viewsThisWeek este 0 dar viewsLastWeek era mai mare ca 0, poți menționa scăderea vizualizărilor.\n" +
        "- Poți adăuga o SINGURĂ sugestie scurtă doar dacă rezultă evident din cifre (ex: topListing cu multe views dar 0 leads → sugerează verificarea prețului sau a pozelor; staleCount mare → sugerează revizuirea prețurilor la mașinile care stau demult).\n" +
        "- LIMBĂ NATURALĂ: nu lipi cifra de cuvinte ca 'toate' sau 'ambele'. Pentru două elemente folosește 'ambele' (nu 'toate 2', nu 'toate două'). Pentru trei sau mai multe folosește 'toate' sau 'toate cele N'. Scrie ca un om, nu ca un raport.\n" +
        "- Fără emoji. Fără markdown. Doar textul rezumatului.";
      const prompt = `Datele reale ale săptămânii (JSON):\n${JSON.stringify(facts, null, 2)}`;
      const aiText = await generateText({
        systemInstruction,
        prompt,
        maxOutputTokens: 300,
        temperature: 0.7,
      });
      if (aiText && aiText.trim().length > 0) {
        summaryText = aiText.trim();
        source = "ai";
      }
    } catch (aiErr) {
      console.error("[weekly-summary] Gemini a eșuat, folosesc fallback:", aiErr.message);
    }

    const payload = {
      text: summaryText,
      source,
      facts,
      generatedAt: new Date().toISOString(),
    };

    weeklySummaryCache.set(cacheKey, payload);
    res.status(200).json(payload);
  } catch (error) {
    console.error("[DEBUG] Eroare în getWeeklySummary:", error);
    res.status(500).json({ message: "Eroare la generarea rezumatului săptămânal." });
  }
};

module.exports = { getStats, getListingAnalytics, getViewsChart, getWeeklySummary };
