// src/controllers/transportController.js
const prisma = require("../config/prismaClient");
const { toNetworkTransportRun, toNetworkTransportInterest } = require("../utils/networkSerializer");
const { sendTransportInterestNotification } = require("../services/emailService");

const createRun = async (req, res) => {
  const { fromCity, toCity, departureDate, seatsTotal, pricePerCar, notes, kind, transportType, acceptsNonRunning, fromCountry, departureDateEnd } = req.body;

  try {
    const run = await prisma.transportRun.create({
      data: {
        businessId: req.user.businessId,
        fromCity,
        toCity,
        departureDate: new Date(departureDate),
        seatsTotal: parseInt(seatsTotal, 10),
        seatsAvailable: parseInt(seatsTotal, 10),
        pricePerCar: pricePerCar !== undefined && pricePerCar !== null ? parseFloat(pricePerCar) : null,
        notes: notes || null,
        status: "OPEN",
        kind: kind || "OFFER",
        transportType: transportType || null,
        acceptsNonRunning: acceptsNonRunning !== undefined ? !!acceptsNonRunning : false,
        fromCountry: fromCountry || null,
        departureDateEnd: departureDateEnd ? new Date(departureDateEnd) : null,
      },
      include: {
        business: true,
      },
    });

    return res.status(201).json(toNetworkTransportRun(run));
  } catch (error) {
    console.error("Eroare la crearea cursei de transport:", error);
    return res.status(500).json({ message: "A apărut o eroare la crearea cursei de transport." });
  }
};

const browseRuns = async (req, res) => {
  const { fromCity, toCity, dateFrom, dateTo, kind, fromCountry } = req.query;
  const now = new Date();

  try {
    const where = {
      status: "OPEN",
      departureDate: { gte: now },
      businessId: { not: req.user.businessId },
    };

    if (fromCity) {
      where.fromCity = { contains: fromCity, mode: "insensitive" };
    }
    if (toCity) {
      where.toCity = { contains: toCity, mode: "insensitive" };
    }
    if (dateFrom || dateTo) {
      where.departureDate = {
        ...where.departureDate,
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }
    if (kind) {
      where.kind = kind;
    }
    if (fromCountry) {
      where.fromCountry = fromCountry.toUpperCase();
    }

    const runs = await prisma.transportRun.findMany({
      where,
      include: {
        business: true,
        interests: { where: { businessId: req.user.businessId }, select: { id: true } }
      },
      orderBy: {
        departureDate: "asc",
      },
    });

    return res.status(200).json(runs.map(toNetworkTransportRun));
  } catch (error) {
    console.error("Eroare la căutarea curselor:", error);
    return res.status(500).json({ message: "A apărut o eroare la încărcarea curselor." });
  }
};

const myRuns = async (req, res) => {
  try {
    const runs = await prisma.transportRun.findMany({
      where: {
        businessId: req.user.businessId,
      },
      include: {
        business: true,
        _count: {
          select: { interests: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(runs.map(toNetworkTransportRun));
  } catch (error) {
    console.error("Eroare la obținerea curselor mele:", error);
    return res.status(500).json({ message: "A apărut o eroare la încărcarea curselor tale." });
  }
};

const getRunInterests = async (req, res) => {
  const { runId } = req.params;

  try {
    const run = await prisma.transportRun.findUnique({
      where: { id: runId },
    });

    if (!run || run.businessId !== req.user.businessId) {
      return res.status(404).json({ message: "Cursa nu a fost găsită sau nu îți aparține." });
    }

    const interests = await prisma.transportInterest.findMany({
      where: { runId },
      include: {
        business: true,
      },
    });

    const mappedInterests = interests.map(toNetworkTransportInterest);

    // Mark unseen interests of this run as seen
    await prisma.transportInterest.updateMany({
      where: {
        runId,
        isSeen: false,
      },
      data: {
        isSeen: true,
      },
    });

    return res.status(200).json(mappedInterests);
  } catch (error) {
    console.error("Eroare la obținerea intereselor pentru cursă:", error);
    return res.status(500).json({ message: "A apărut o eroare la obținerea intereselor." });
  }
};

const expressInterest = async (req, res) => {
  const { runId } = req.params;
  const { seatsRequested, note } = req.body;

  try {
    const run = await prisma.transportRun.findUnique({
      where: { id: runId },
      include: {
        business: true,
      },
    });

    if (!run) {
      return res.status(404).json({ message: "Cursa nu a fost găsită." });
    }

    if (run.businessId === req.user.businessId) {
      return res.status(400).json({ message: "Nu poți fi interesat de propria cursă." });
    }

    if (run.status !== "OPEN") {
      return res.status(400).json({ message: "Cursa nu mai este deschisă." });
    }

    const interest = await prisma.transportInterest.create({
      data: {
        runId,
        businessId: req.user.businessId,
        seatsRequested: seatsRequested !== undefined ? parseInt(seatsRequested, 10) : 1,
        note: note || null,
      },
      include: {
        business: true,
      },
    });

    // Fire-and-forget notification
    (async () => {
      const callerBusiness = await prisma.business.findUnique({
        where: { id: req.user.businessId },
        select: {
          networkDisplayName: true,
          name: true,
        },
      });

      const fromDealerName = callerBusiness
        ? (callerBusiness.networkDisplayName || callerBusiness.name)
        : "Alt Dealer";

      const toEmail = run.business.networkContactEmail || run.business.companyEmail;
      if (toEmail) {
        await sendTransportInterestNotification({
          toEmail,
          fromDealerName,
          fromCity: run.fromCity,
          toCity: run.toCity,
          seatsRequested: seatsRequested !== undefined ? parseInt(seatsRequested, 10) : 1,
          note,
        });
      }
    })().catch((err) => {
      console.error("Eroare fire-and-forget la notificare email interes transport:", err);
    });

    return res.status(201).json(toNetworkTransportInterest(interest));
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Ți-ai exprimat deja interesul." });
    }
    console.error("Eroare la exprimarea interesului pentru cursă:", error);
    return res.status(500).json({ message: "A apărut o eroare la salvarea interesului." });
  }
};

const updateRun = async (req, res) => {
  const { id } = req.params;
  const { status, seatsAvailable, notes, pricePerCar } = req.body;

  try {
    const existingRun = await prisma.transportRun.findFirst({
      where: {
        id,
        businessId: req.user.businessId,
      },
    });

    if (!existingRun) {
      return res.status(404).json({ message: "Cursa nu a fost găsită sau nu îți aparține." });
    }

    const updated = await prisma.transportRun.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(seatsAvailable !== undefined ? { seatsAvailable: parseInt(seatsAvailable, 10) } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(pricePerCar !== undefined ? { pricePerCar: pricePerCar !== null ? parseFloat(pricePerCar) : null } : {}),
      },
      include: {
        business: true,
      },
    });

    return res.status(200).json(toNetworkTransportRun(updated));
  } catch (error) {
    console.error("Eroare la actualizarea cursei de transport:", error);
    return res.status(500).json({ message: "A apărut o eroare la actualizarea cursei." });
  }
};

const deleteRun = async (req, res) => {
  const { id } = req.params;

  try {
    const existingRun = await prisma.transportRun.findFirst({
      where: {
        id,
        businessId: req.user.businessId,
      },
    });

    if (!existingRun) {
      return res.status(404).json({ message: "Cursa nu a fost găsită sau nu îți aparține." });
    }

    await prisma.transportRun.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Cursa a fost ștearsă cu succes." });
  } catch (error) {
    console.error("Eroare la ștergerea cursei de transport:", error);
    return res.status(500).json({ message: "A apărut o eroare la ștergerea cursei." });
  }
};

const interestsCount = async (req, res) => {
  try {
    const count = await prisma.transportInterest.count({
      where: {
        isSeen: false,
        run: {
          businessId: req.user.businessId,
        },
      },
    });

    return res.status(200).json({ count });
  } catch (error) {
    console.error("Eroare la obținerea numărului de interese necitite:", error);
    return res.status(500).json({ message: "A apărut o eroare la numărarea intereselor." });
  }
};

module.exports = {
  createRun,
  browseRuns,
  myRuns,
  getRunInterests,
  expressInterest,
  updateRun,
  deleteRun,
  interestsCount,
};
