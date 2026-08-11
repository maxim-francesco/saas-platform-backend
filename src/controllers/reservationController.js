const prisma = require("../config/prismaClient");

async function releaseExpiredReservations(businessId) {
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: { businessId, status: "ACTIVE", expiresAt: { lt: now } },
    select: { id: true, listingId: true },
  });
  if (expired.length === 0) return;
  const reservationIds = expired.map(r => r.id);
  const listingIds = expired.map(r => r.listingId);
  await prisma.reservation.updateMany({ where: { id: { in: reservationIds } }, data: { status: "EXPIRED" } });
  // only flip listings that are still RESERVED (don't override SOLD etc.)
  await prisma.listing.updateMany({ where: { id: { in: listingIds }, businessId, status: "RESERVED" }, data: { status: "AVAILABLE" } });
}

const createReservation = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { listingId, clientName, clientPhone, depositAmount, reservationDays } = req.body;

    // SECURITY: verify listing belongs to business
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId }
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu există sau nu aveți acces." });
    }

    if (listing.status === "SOLD") {
      return res.status(400).json({ message: "Mașina este deja vândută." });
    }

    if (listing.status === "RESERVED") {
      return res.status(400).json({ message: "Mașina este deja rezervată." });
    }

    const days = reservationDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          businessId,
          listingId,
          clientName,
          clientPhone,
          depositAmount: parseFloat(depositAmount),
          expiresAt
        }
      });
      await tx.listing.update({
        where: { id: listingId },
        data: { status: "RESERVED" }
      });
      return reservation;
    });

    return res.status(201).json({
      id: result.id,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error("Eroare la crearea rezervării:", error);
    return res.status(500).json({ message: "Eroare la crearea rezervării." });
  }
};

const listReservations = async (req, res) => {
  try {
    const { businessId } = req.user;
    // Lazy release expired ones
    await releaseExpiredReservations(businessId);

    const reservations = await prisma.reservation.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: { id: true, title: true, status: true }
        }
      }
    });

    return res.status(200).json(reservations);
  } catch (error) {
    console.error("Eroare la listarea rezervărilor:", error);
    return res.status(500).json({ message: "Eroare la listarea rezervărilor." });
  }
};

const completeReservation = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const reservation = await prisma.reservation.findFirst({
      where: { id, businessId }
    });

    if (!reservation) {
      return res.status(404).json({ message: "Rezervarea nu a fost găsită." });
    }

    if (reservation.status !== "ACTIVE") {
      return res.status(400).json({ message: "Numai o rezervare activă poate fi finalizată." });
    }

    // Set reservation status COMPLETED
    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: "COMPLETED" }
    });

    // NOTE: The listing status is intentionally left as RESERVED so that the vehicle is 
    // not re-listed back to AVAILABLE while the sale/contract is being finalized by the dealer.
    
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare la finalizarea rezervării:", error);
    return res.status(500).json({ message: "Eroare la finalizarea rezervării." });
  }
};

const extendReservation = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;
    const { days } = req.body;
    const addDays = parseInt(days, 10);
    if (!addDays || addDays < 1 || addDays > 365) {
      return res.status(400).json({ message: "Numărul de zile trebuie să fie între 1 și 365." });
    }
    const reservation = await prisma.reservation.findFirst({
      where: { id, businessId }
    });
    if (!reservation) {
      return res.status(404).json({ message: "Rezervarea nu a fost găsită." });
    }
    if (reservation.status !== "ACTIVE") {
      return res.status(400).json({ message: "Numai o rezervare activă poate fi prelungită." });
    }
    const base = Math.max(Date.now(), new Date(reservation.expiresAt).getTime());
    const newExpiresAt = new Date(base + addDays * 24 * 60 * 60 * 1000);
    const updated = await prisma.reservation.update({
      where: { id },
      data: { expiresAt: newExpiresAt }
    });
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare la prelungirea rezervării:", error);
    return res.status(500).json({ message: "Eroare la prelungirea rezervării." });
  }
};

const cancelReservation = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { id } = req.params;

    const reservation = await prisma.reservation.findFirst({
      where: { id, businessId }
    });

    if (!reservation) {
      return res.status(404).json({ message: "Rezervarea nu a fost găsită." });
    }

    if (reservation.status !== "ACTIVE") {
      return res.status(400).json({ message: "Numai o rezervare activă poate fi anulată." });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resUpdated = await tx.reservation.update({
        where: { id },
        data: { status: "CANCELLED" }
      });
      
      // flip listing back to AVAILABLE only if it's currently RESERVED
      const listing = await tx.listing.findUnique({
        where: { id: reservation.listingId },
        select: { status: true }
      });

      if (listing && listing.status === "RESERVED") {
        await tx.listing.update({
          where: { id: reservation.listingId },
          data: { status: "AVAILABLE" }
        });
      }

      return resUpdated;
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare la anularea rezervării:", error);
    return res.status(500).json({ message: "Eroare la anularea rezervării." });
  }
};

module.exports = {
  createReservation,
  listReservations,
  completeReservation,
  cancelReservation,
  extendReservation,
  releaseExpiredReservations
};
