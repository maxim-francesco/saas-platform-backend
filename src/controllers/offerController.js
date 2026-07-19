const prisma = require("../config/prismaClient");
const crypto = require("crypto");
const { generateSlug, generateCode } = require("../utils/slugify");

const createOffer = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { listingId, clientName, clientPhone, offerPrice, listPrice, validityDays } = req.body;

    // SECURITY: verify the listing belongs to this business
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: { images: { orderBy: { order: 'asc' }, take: 1 } }
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu există sau nu aparține acestui business." });
    }

    const listingTitleSnapshot = listing.title;
    const listingImageSnapshot = listing.images?.[0]?.url || null;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true }
    });

    const bizSlug = generateSlug(business?.name || 'oferta');
    const carSlug = generateSlug(listing.title || 'masina');

    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode(8);
      const exists = await prisma.offer.findUnique({ where: { code: candidate } });
      if (!exists) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return res.status(500).json({ message: "Eroare la generarea codului ofertei." });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const offer = await prisma.offer.create({
      data: {
        businessId,
        listingId,
        clientName,
        clientPhone,
        offerPrice,
        listPrice: listPrice ?? null,
        validityDays,
        listingTitleSnapshot,
        listingImageSnapshot,
        token,
        code,
        bizSlug,
        expiresAt
      }
    });

    const base = process.env.PUBLIC_BASE_URL || "http://localhost:4400";
    const publicUrl = `${base}/oferta/${bizSlug}/${carSlug}-${code}`;

    return res.status(201).json({
      token,
      code,
      publicUrl,
      expiresAt
    });
  } catch (error) {
    console.error("Eroare la crearea ofertei:", error);
    return res.status(500).json({ message: "Eroare la crearea ofertei." });
  }
};

module.exports = { createOffer };
