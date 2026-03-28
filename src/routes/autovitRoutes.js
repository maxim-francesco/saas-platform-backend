const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/authMiddleware");
const prisma = require("../config/prismaClient");
const autovitService = require("../services/autovitService");

// POST /api/autovit/:listingId/export-olx
router.post("/:listingId/export-olx", isAuthenticated, async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: { business: true },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    }

    if (!listing.autovitId) {
      return res.status(400).json({ message: "Anunțul nu este publicat pe Autovit." });
    }

    if (listing.autovitStatus !== "active") {
      return res.status(400).json({ message: "Anunțul trebuie să fie activ pe Autovit înainte de export OLX." });
    }

    const b = listing.business;
    if (!b?.autovitClientId) {
      return res.status(400).json({ message: "Credențiale Autovit lipsesc." });
    }

    const token = await autovitService.getAccessToken(
      b.autovitClientId, b.autovitClientSecret,
      b.autovitUsername, b.autovitPassword
    );

    await autovitService.exportToOLX(listing.autovitId, token, b.autovitUsername);

    res.status(200).json({ message: "Anunțul a fost exportat pe OLX cu succes." });
  } catch (error) {
    console.error("[Autovit] Eroare export OLX:", error.message);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/autovit/:listingId/activate
router.post("/:listingId/activate", isAuthenticated, async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: { business: true },
    });

    if (!listing?.autovitId) {
      return res.status(404).json({ message: "Anunțul nu există pe Autovit." });
    }

    const b = listing.business;
    const token = await autovitService.getAccessToken(
      b.autovitClientId, b.autovitClientSecret,
      b.autovitUsername, b.autovitPassword
    );

    await autovitService.activateAdvert(listing.autovitId, token, b.autovitUsername);

    await prisma.listing.update({
      where: { id: listingId },
      data: { autovitStatus: "active" },
    });

    res.status(200).json({ message: "Anunțul a fost activat pe Autovit." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/autovit/:listingId/deactivate
router.post("/:listingId/deactivate", isAuthenticated, async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: { business: true },
    });

    if (!listing?.autovitId) {
      return res.status(404).json({ message: "Anunțul nu există pe Autovit." });
    }

    const b = listing.business;
    const token = await autovitService.getAccessToken(
      b.autovitClientId, b.autovitClientSecret,
      b.autovitUsername, b.autovitPassword
    );

    await autovitService.deactivateAdvert(listing.autovitId, token, b.autovitUsername);

    await prisma.listing.update({
      where: { id: listingId },
      data: { autovitStatus: "inactive" },
    });

    res.status(200).json({ message: "Anunțul a fost dezactivat pe Autovit." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:listingId/status", isAuthenticated, async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      select: { autovitId: true, autovitStatus: true },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    }

    res.status(200).json({
      autovitId: listing.autovitId ? listing.autovitId.toString() : null,
      autovitStatus: listing.autovitStatus,
    });
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea statusului." });
  }
});

// POST /api/autovit/:listingId/publish
router.post("/:listingId/publish", isAuthenticated, async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: {
        business: true,
        attributeValues: { include: { attribute: true } },
        images: { orderBy: { order: "asc" } },
      },
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    }

    const b = listing.business;
    if (!b?.autovitClientId || !b?.autovitUsername) {
      return res.status(400).json({ message: "Credențiale Autovit lipsesc pentru acest business." });
    }

    const token = await autovitService.getAccessToken(
      b.autovitClientId, b.autovitClientSecret,
      b.autovitUsername, b.autovitPassword
    );

    let currentAutovitId = listing.autovitId;

    if (!currentAutovitId) {
      const imageUrls = listing.images.map(img => img.url);
      if (imageUrls.length === 0) {
        return res.status(400).json({ message: "Anunțul nu are imagini adăugate. Trebuie să adaugi cel puțin o imagine." });
      }

      // Creăm colecția de imagini
      const imageCollectionId = await autovitService.createImageCollection(
        imageUrls, token, b.autovitUsername
      );

      // Mapăm anunțul la formatul pentru Autovit
      const payload = autovitService.mapListingToAutovit(listing, imageCollectionId);

      // Creăm efectiv anunțul online
      const result = await autovitService.createAdvert(payload, token, b.autovitUsername);
      currentAutovitId = result.id;

      // Salvăm noul ID (ne bazăm pe formatul cerut BigInt, funcție de setarea schemelor)
      await prisma.listing.update({
        where: { id: listingId },
        data: { autovitId: BigInt(currentAutovitId), autovitStatus: "inactive" },
      });
      console.log(`[Autovit] Anunț nou creat manual cu ID: ${currentAutovitId}`);
    }

    // Pas 1: Activare Autovit
    await autovitService.activateAdvert(currentAutovitId, token, b.autovitUsername);
    await prisma.listing.update({
      where: { id: listingId },
      data: { autovitStatus: "active" },
    });
    console.log(`[Autovit] Anunț ${currentAutovitId} activat.`);

    // Pas 2: Export OLX
    let olxSuccess = false;
    try {
      await autovitService.exportToOLX(currentAutovitId, token, b.autovitUsername);
      olxSuccess = true;
      console.log(`[Autovit] Anunț ${currentAutovitId} exportat pe OLX.`);
    } catch (olxErr) {
      console.error(`[Autovit] Export OLX eșuat:`, olxErr.message);
    }

    res.status(200).json({
      message: olxSuccess
        ? "Anunțul a fost creat, activat pe Autovit și exportat pe OLX!"
        : "Anunțul este pe Autovit. Exportul OLX a eșuat.",
      autovitStatus: "active",
      olxSuccess,
    });
  } catch (error) {
    console.error("[Autovit] Eroare publish:", error.message);
    res.status(500).json({ message: error.message || "A apărut o eroare necunoscută la publicare." });
  }
});

module.exports = router;