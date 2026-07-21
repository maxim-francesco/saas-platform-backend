// src/controllers/tradeController.js
const prisma = require("../config/prismaClient");
const { toTradeListing } = require("../utils/networkSerializer");

const getSlowStock = async (req, res) => {
  const caller = req.user.businessId;
  let days = parseInt(req.query.days, 10);
  if (isNaN(days)) {
    days = 60;
  }
  // Clamp days between 0 and 3650
  days = Math.max(0, Math.min(3650, days));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const listings = await prisma.listing.findMany({
      where: {
        businessId: caller,
        status: "AVAILABLE",
        createdAt: {
          lte: cutoff,
        },
      },
      include: {
        make: true,
        model: true,
        images: {
          orderBy: {
            order: "asc",
          },
        },
        tradeListing: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const result = listings.map((l) => ({
      listingId: l.id,
      title: l.title,
      make: l.make?.name || null,
      model: l.model?.name || null,
      year: l.year,
      mileage: l.mileage,
      price: l.price,
      image: l.images?.[0]?.url || null,
      daysInStock: Math.floor((Date.now() - new Date(l.createdAt)) / 86400000),
      isExposed: !!(l.tradeListing && l.tradeListing.status === "ACTIVE"),
      tradeStatus: l.tradeListing?.status || null,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in getSlowStock:", error);
    return res.status(500).json({ message: "Eroare la obținerea mașinilor din slow-stock." });
  }
};

const exposeListing = async (req, res) => {
  const caller = req.user.businessId;
  const { listingId, b2bPrice, acceptsTrade, note } = req.body;

  try {
    const listing = await prisma.listing.findFirst({
      where: {
        id: listingId,
        businessId: caller,
        status: "AVAILABLE",
      },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit sau nu e disponibil." });
    }

    const tradeListing = await prisma.networkTradeListing.upsert({
      where: { listingId: listingId },
      update: {
        status: "ACTIVE",
        b2bPrice: b2bPrice !== undefined ? b2bPrice : undefined,
        acceptsTrade: acceptsTrade !== undefined ? acceptsTrade : undefined,
        note: note !== undefined ? note : undefined,
      },
      create: {
        listingId: listingId,
        businessId: caller,
        status: "ACTIVE",
        b2bPrice: b2bPrice ?? null,
        acceptsTrade: acceptsTrade ?? false,
        note: note ?? null,
      },
    });

    const reFetched = await prisma.networkTradeListing.findUnique({
      where: { id: tradeListing.id },
      include: {
        listing: {
          include: {
            make: true,
            model: true,
            images: {
              orderBy: { order: "asc" },
            },
          },
        },
        business: true,
      },
    });

    return res.status(200).json(toTradeListing(reFetched));
  } catch (error) {
    console.error("Error in exposeListing:", error);
    return res.status(500).json({ message: "Eroare la expunerea anunțului." });
  }
};

const getMyTradeListings = async (req, res) => {
  const caller = req.user.businessId;

  try {
    const tradeListings = await prisma.networkTradeListing.findMany({
      where: {
        businessId: caller,
        status: {
          in: ["ACTIVE", "CLOSED"],
        },
      },
      include: {
        listing: {
          include: {
            make: true,
            model: true,
            images: {
              orderBy: { order: "asc" },
            },
          },
        },
        business: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.status(200).json(tradeListings.map(toTradeListing));
  } catch (error) {
    console.error("Error in getMyTradeListings:", error);
    return res.status(500).json({ message: "Eroare la obținerea anunțurilor expuse de tine." });
  }
};

const browseTradeListings = async (req, res) => {
  const caller = req.user.businessId;

  try {
    const tradeListings = await prisma.networkTradeListing.findMany({
      where: {
        status: "ACTIVE",
        businessId: { not: caller },
        listing: {
          status: "AVAILABLE",
        },
      },
      include: {
        listing: {
          include: {
            make: true,
            model: true,
            images: {
              orderBy: { order: "asc" },
            },
          },
        },
        business: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let results = tradeListings;

    // Filter by acceptsTrade if present
    if (req.query.acceptsTrade === "true") {
      results = results.filter((tl) => tl.acceptsTrade === true);
    }

    // Filter by priceMax if present
    if (req.query.priceMax !== undefined) {
      const priceMax = parseFloat(req.query.priceMax);
      if (!isNaN(priceMax)) {
        results = results.filter((tl) => {
          const effectivePrice =
            tl.b2bPrice !== null && tl.b2bPrice !== undefined ? tl.b2bPrice : (tl.listing?.price ?? 0);
          return effectivePrice <= priceMax;
        });
      }
    }

    // Filter by make if present
    if (req.query.make) {
      const makeSearch = req.query.make.toLowerCase();
      results = results.filter((tl) =>
        tl.listing?.make?.name?.toLowerCase().includes(makeSearch)
      );
    }

    return res.status(200).json(results.map(toTradeListing));
  } catch (error) {
    console.error("Error in browseTradeListings:", error);
    return res.status(500).json({ message: "Eroare la răsfoirea anunțurilor." });
  }
};

const getTradeListing = async (req, res) => {
  const { id } = req.params;

  try {
    const tradeListing = await prisma.networkTradeListing.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            make: true,
            model: true,
            images: {
              orderBy: { order: "asc" },
            },
          },
        },
        business: true,
      },
    });

    if (!tradeListing) {
      return res.status(404).json({ message: "Anunțul de trade nu a fost găsit." });
    }

    return res.status(200).json(toTradeListing(tradeListing));
  } catch (error) {
    console.error("Error in getTradeListing:", error);
    return res.status(500).json({ message: "Eroare la obținerea anunțului de trade." });
  }
};

const updateTradeListing = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;
  const { b2bPrice, acceptsTrade, note, status } = req.body;

  try {
    const tradeListing = await prisma.networkTradeListing.findUnique({
      where: { id },
    });

    if (!tradeListing || tradeListing.businessId !== caller) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit sau nu ești proprietarul acestuia." });
    }

    const updated = await prisma.networkTradeListing.update({
      where: { id },
      data: {
        b2bPrice: b2bPrice !== undefined ? b2bPrice : undefined,
        acceptsTrade: acceptsTrade !== undefined ? acceptsTrade : undefined,
        note: note !== undefined ? note : undefined,
        status: status !== undefined ? status : undefined,
      },
      include: {
        listing: {
          include: {
            make: true,
            model: true,
            images: {
              orderBy: { order: "asc" },
            },
          },
        },
        business: true,
      },
    });

    return res.status(200).json(toTradeListing(updated));
  } catch (error) {
    console.error("Error in updateTradeListing:", error);
    return res.status(500).json({ message: "Eroare la actualizarea anunțului." });
  }
};

const unexposeListing = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;

  try {
    const tradeListing = await prisma.networkTradeListing.findUnique({
      where: { id },
    });

    if (!tradeListing || tradeListing.businessId !== caller) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit sau nu ești proprietarul acestuia." });
    }

    await prisma.networkTradeListing.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Anunțul a fost eliminat din rețeaua de trade." });
  } catch (error) {
    console.error("Error in unexposeListing:", error);
    return res.status(500).json({ message: "Eroare la eliminarea anunțului." });
  }
};

module.exports = {
  getSlowStock,
  exposeListing,
  getMyTradeListings,
  browseTradeListings,
  getTradeListing,
  updateTradeListing,
  unexposeListing,
};
