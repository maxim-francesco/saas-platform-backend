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

module.exports = router;