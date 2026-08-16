const prisma = require("../config/prismaClient");
const { normalizeRoPhone } = require("../utils/phone");

const createAppointment = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { title, type, startAt, endAt, clientName, clientPhone, listingId, notes } = req.body;

    let finalListingId = (listingId && listingId.trim() !== "") ? listingId : null;
    if (finalListingId) {
      const listing = await prisma.listing.findFirst({
        where: { id: finalListingId, businessId }
      });
      if (!listing) {
        return res.status(400).json({ message: "Mașina selectată nu este validă." });
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        title,
        type: type || "OTHER",
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        clientName: clientName || null,
        clientPhone: normalizeRoPhone(clientPhone),
        listingId: finalListingId,
        notes: notes || null
      }
    });

    return res.status(201).json(appointment);
  } catch (error) {
    console.error("Eroare la crearea programării:", error);
    return res.status(500).json({ message: "Eroare la crearea programării." });
  }
};

const listAppointments = async (req, res) => {
  try {
    const { businessId } = req.user;
    const { start, end } = req.query;

    const where = { businessId };
    if (start && end) {
      where.startAt = {
        gte: new Date(start),
        lte: new Date(end)
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: {
        startAt: "asc"
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    return res.status(200).json(appointments);
  } catch (error) {
    console.error("Eroare la listarea programărilor:", error);
    return res.status(500).json({ message: "Eroare la listarea programărilor." });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.user;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId }
    });
    if (!existing) {
      return res.status(404).json({ message: "Programarea nu a fost găsită." });
    }

    const data = {};
    const fields = ['title', 'type', 'status', 'notes'];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    });

    if (req.body.startAt !== undefined) {
      data.startAt = new Date(req.body.startAt);
    }
    if (req.body.endAt !== undefined) {
      data.endAt = new Date(req.body.endAt);
    }

    if (req.body.clientName !== undefined) {
      data.clientName = (req.body.clientName === "" || req.body.clientName === null) ? null : req.body.clientName;
    }
    if (req.body.clientPhone !== undefined) {
      data.clientPhone = (req.body.clientPhone === "" || req.body.clientPhone === null) ? null : req.body.clientPhone;
    }

    if (req.body.listingId !== undefined) {
      const finalListingId = (req.body.listingId === "" || req.body.listingId === null) ? null : req.body.listingId;
      if (finalListingId) {
        const listing = await prisma.listing.findFirst({
          where: { id: finalListingId, businessId }
        });
        if (!listing) {
          return res.status(400).json({ message: "Mașina selectată nu este validă." });
        }
      }
      data.listingId = finalListingId;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare la actualizarea programării:", error);
    return res.status(500).json({ message: "Eroare la actualizarea programării." });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.user;

    const existing = await prisma.appointment.findFirst({
      where: { id, businessId }
    });
    if (!existing) {
      return res.status(404).json({ message: "Programarea nu a fost găsită." });
    }

    await prisma.appointment.delete({
      where: { id }
    });

    return res.status(200).json({ message: "Programare ștearsă." });
  } catch (error) {
    console.error("Eroare la ștergerea programării:", error);
    return res.status(500).json({ message: "Eroare la ștergerea programării." });
  }
};

module.exports = {
  createAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment
};
