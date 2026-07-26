const prisma = require("../config/prismaClient");

const normalizePhone = (raw) => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null; // Prea scurt pentru a fi un număr valid

  if (digits.startsWith("0")) {
    if (digits.length >= 10) {
      return "40" + digits.substring(1);
    }
  }
  return digits;
};

const pickName = (existing, candidate) => {
  const ext = (existing || "").trim();
  const cand = (candidate || "").trim();
  if (cand.length > ext.length) return cand;
  return ext;
};

const listCustomers = async (req, res) => {
  try {
    const { businessId } = req.user;

    const [buyers, reservations, appointments, messages, offers] = await Promise.all([
      prisma.buyer.findMany({
        where: { businessId },
        include: {
          contracts: {
            select: {
              id: true,
              contractNumber: true,
              salePrice: true,
              saleDate: true,
              vehicleSnapshot: true,
              createdAt: true,
            }
          }
        }
      }),
      prisma.reservation.findMany({
        where: { businessId },
        select: {
          clientName: true,
          clientPhone: true,
          depositAmount: true,
          createdAt: true,
          id: true,
          status: true,
          expiresAt: true,
          listing: { select: { title: true } }
        }
      }),
      prisma.appointment.findMany({
        where: { businessId },
        select: {
          clientName: true,
          clientPhone: true,
          type: true,
          startAt: true,
          createdAt: true,
          id: true,
          title: true,
          status: true,
        }
      }),
      prisma.message.findMany({
        where: { businessId },
        select: {
          name: true,
          phone: true,
          createdAt: true,
          id: true,
          status: true,
          reminderAt: true,
        }
      }),
      prisma.offer.findMany({
        where: { businessId },
        select: {
          clientName: true,
          clientPhone: true,
          createdAt: true,
          viewedAt: true,
          id: true,
          offerPrice: true,
          expiresAt: true,
          listingTitleSnapshot: true,
        }
      })
    ]);

    const customerMap = new Map();

    const getOrCreateCustomer = (phone, initialName) => {
      const normalized = normalizePhone(phone);
      if (!normalized) return null;
      if (!customerMap.has(normalized)) {
        customerMap.set(normalized, {
          phone: normalized,
          name: initialName || "",
          contractsCount: 0,
          reservationsCount: 0,
          appointmentsCount: 0,
          messagesCount: 0,
          offersCount: 0,
          purchasedCars: [],
          lastInteraction: new Date(0),
          sources: new Set(),
          activeReservation: null,
          pendingOffer: null,
          nextAppointment: null,
          openLead: null,
        });
      }
      return customerMap.get(normalized);
    };

    const now = new Date();

    // 1. Buyers / Contracts
    for (const buyer of buyers) {
      const cust = getOrCreateCustomer(buyer.phone, buyer.name);
      if (!cust) continue;

      cust.sources.add("contract");
      cust.name = pickName(cust.name, buyer.name);
      cust.contractsCount += buyer.contracts.length;

      for (const contract of buyer.contracts) {
        let carTitle = null;
        if (contract.vehicleSnapshot) {
          try {
            const snapshot = typeof contract.vehicleSnapshot === 'string'
              ? JSON.parse(contract.vehicleSnapshot)
              : contract.vehicleSnapshot;
            carTitle = snapshot.title;
          } catch (e) {
            console.error("Eroare la parsarea vehicleSnapshot:", e);
          }
        }
        if (carTitle && !cust.purchasedCars.includes(carTitle)) {
          cust.purchasedCars.push(carTitle);
        }

        const dateToUse = contract.saleDate ? new Date(contract.saleDate) : new Date(contract.createdAt);
        if (dateToUse > cust.lastInteraction) {
          cust.lastInteraction = dateToUse;
        }
      }

      const buyerCreated = new Date(buyer.createdAt);
      if (buyerCreated > cust.lastInteraction) {
        cust.lastInteraction = buyerCreated;
      }
    }

    // 2. Reservations
    for (const resv of reservations) {
      const cust = getOrCreateCustomer(resv.clientPhone, resv.clientName);
      if (!cust) continue;

      cust.sources.add("reservation");
      cust.name = pickName(cust.name, resv.clientName);
      cust.reservationsCount++;

      if (resv.status === 'ACTIVE') {
        const expiresAtDate = new Date(resv.expiresAt);
        if (!cust.activeReservation || expiresAtDate < new Date(cust.activeReservation.expiresAt)) {
          cust.activeReservation = {
            id: resv.id,
            car: resv.listing?.title || null,
            expiresAt: expiresAtDate.toISOString(),
            depositAmount: resv.depositAmount,
          };
        }
      }

      const resvCreated = new Date(resv.createdAt);
      if (resvCreated > cust.lastInteraction) {
        cust.lastInteraction = resvCreated;
      }
    }

    // 3. Appointments
    for (const appt of appointments) {
      const cust = getOrCreateCustomer(appt.clientPhone, appt.clientName);
      if (!cust) continue;

      cust.sources.add("appointment");
      cust.name = pickName(cust.name, appt.clientName);
      cust.appointmentsCount++;

      if (appt.status === 'SCHEDULED') {
        const startAtDate = new Date(appt.startAt);
        if (startAtDate > now) {
          if (!cust.nextAppointment || startAtDate < new Date(cust.nextAppointment.startAt)) {
            cust.nextAppointment = {
              id: appt.id,
              title: appt.title,
              type: appt.type,
              startAt: startAtDate.toISOString(),
            };
          }
        }
      }

      const apptCreated = new Date(appt.createdAt);
      if (apptCreated > cust.lastInteraction) {
        cust.lastInteraction = apptCreated;
      }
      const apptStart = new Date(appt.startAt);
      if (apptStart <= now) {
        if (apptStart > cust.lastInteraction) {
          cust.lastInteraction = apptStart;
        }
      }
    }

    // 4. Messages / Leads
    for (const msg of messages) {
      const cust = getOrCreateCustomer(msg.phone, msg.name);
      if (!cust) continue;

      cust.sources.add("message");
      cust.name = pickName(cust.name, msg.name);
      cust.messagesCount++;

      if (msg.status !== 'WON' && msg.status !== 'LOST') {
        const msgCreatedDate = new Date(msg.createdAt);
        if (!cust.openLead || msgCreatedDate > new Date(cust.openLead.createdAt)) {
          cust.openLead = {
            id: msg.id,
            status: msg.status,
            createdAt: msgCreatedDate.toISOString(),
            reminderAt: msg.reminderAt ? new Date(msg.reminderAt).toISOString() : null,
          };
        }
      }

      const msgCreated = new Date(msg.createdAt);
      if (msgCreated > cust.lastInteraction) {
        cust.lastInteraction = msgCreated;
      }
    }

    // 5. Offers
    for (const offer of offers) {
      const cust = getOrCreateCustomer(offer.clientPhone, offer.clientName);
      if (!cust) continue;
      cust.sources.add("offer");
      cust.name = pickName(cust.name, offer.clientName);
      cust.offersCount++;

      const offerExpiresAtDate = new Date(offer.expiresAt);
      if (offerExpiresAtDate > now) {
        if (!cust.pendingOffer || offerExpiresAtDate < new Date(cust.pendingOffer.expiresAt)) {
          cust.pendingOffer = {
            id: offer.id,
            car: offer.listingTitleSnapshot || null,
            offerPrice: offer.offerPrice,
            expiresAt: offerExpiresAtDate.toISOString(),
            viewedAt: offer.viewedAt ? new Date(offer.viewedAt).toISOString() : null,
          };
        }
      }

      const created = new Date(offer.createdAt);
      if (created > cust.lastInteraction) cust.lastInteraction = created;
      if (offer.viewedAt) {
        const viewed = new Date(offer.viewedAt);
        if (viewed > cust.lastInteraction) cust.lastInteraction = viewed;
      }
    }

    const customersArray = Array.from(customerMap.values()).map(c => ({
      ...c,
      sources: Array.from(c.sources),
      lastInteraction: c.lastInteraction.getTime() === 0 ? null : c.lastInteraction.toISOString(),
    }));

    const sortedArray = customersArray.sort((a, b) => {
      const timeA = a.lastInteraction ? new Date(a.lastInteraction).getTime() : 0;
      const timeB = b.lastInteraction ? new Date(b.lastInteraction).getTime() : 0;
      return timeB - timeA;
    });

    return res.status(200).json(sortedArray);
  } catch (error) {
    console.error("Eroare la listarea clienților:", error);
    return res.status(500).json({ message: "Eroare la listarea clienților." });
  }
};

const getCustomer = async (req, res) => {
  try {
    const { businessId } = req.user;
    const targetPhone = req.params.phone;

    const [buyers, reservations, appointments, messages, offers] = await Promise.all([
      prisma.buyer.findMany({
        where: { businessId },
        include: {
          contracts: {
            include: {
              listing: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        }
      }),
      prisma.reservation.findMany({
        where: { businessId },
        include: {
          listing: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }),
      prisma.appointment.findMany({
        where: { businessId },
        include: {
          listing: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }),
      prisma.message.findMany({
        where: { businessId },
        include: {
          listing: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }),
      prisma.offer.findMany({
        where: { businessId },
        include: { listing: { select: { id: true, title: true } } }
      })
    ]);

    const matchedBuyers = buyers.filter(b => normalizePhone(b.phone) === targetPhone);
    const matchedReservations = reservations.filter(r => normalizePhone(r.clientPhone) === targetPhone);
    const matchedAppointments = appointments.filter(a => normalizePhone(a.clientPhone) === targetPhone);
    const matchedMessages = messages.filter(m => normalizePhone(m.phone) === targetPhone);
    const matchedOffers = offers.filter(o => normalizePhone(o.clientPhone) === targetPhone);

    if (matchedBuyers.length === 0 && matchedReservations.length === 0 && matchedAppointments.length === 0 && matchedMessages.length === 0 && matchedOffers.length === 0) {
      return res.status(404).json({ message: "Client negăsit." });
    }

    let bestName = "";
    matchedBuyers.forEach(b => { bestName = pickName(bestName, b.name); });
    matchedReservations.forEach(r => { bestName = pickName(bestName, r.clientName); });
    matchedAppointments.forEach(a => { bestName = pickName(bestName, a.clientName); });
    matchedMessages.forEach(m => { bestName = pickName(bestName, m.name); });
    matchedOffers.forEach(o => { bestName = pickName(bestName, o.clientName); });

    const contracts = [];
    matchedBuyers.forEach(buyer => {
      buyer.contracts.forEach(contract => {
        let carTitle = contract.listing?.title || null;
        if (!carTitle && contract.vehicleSnapshot) {
          try {
            const snapshot = typeof contract.vehicleSnapshot === 'string'
              ? JSON.parse(contract.vehicleSnapshot)
              : contract.vehicleSnapshot;
            carTitle = snapshot.title;
          } catch (e) {
            console.error("Eroare la parsarea vehicleSnapshot:", e);
          }
        }
        contracts.push({
          id: contract.id,
          contractNumber: contract.contractNumber,
          car: carTitle,
          salePrice: contract.salePrice,
          saleDate: contract.saleDate ? contract.saleDate.toISOString() : null,
          createdAt: contract.createdAt.toISOString()
        });
      });
    });

    const formattedReservations = matchedReservations.map(r => ({
      id: r.id,
      car: r.listing?.title || null,
      listingId: r.listingId,
      depositAmount: r.depositAmount,
      status: r.status,
      createdAt: r.createdAt.toISOString()
    }));

    const formattedAppointments = matchedAppointments.map(a => ({
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      notes: a.notes,
      createdAt: a.createdAt.toISOString()
    }));

    const formattedMessages = matchedMessages.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      message: m.message,
      type: m.type,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      car: m.listing?.title || null,
      listingId: m.listingId
    }));

    const formattedOffers = matchedOffers.map(o => ({
      id: o.id,
      car: o.listing?.title || o.listingTitleSnapshot || null,
      listingId: o.listingId,
      offerPrice: o.offerPrice,
      listPrice: o.listPrice,
      createdAt: o.createdAt.toISOString(),
      expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
      viewedAt: o.viewedAt ? o.viewedAt.toISOString() : null,
    }));

    const detail = {
      phone: targetPhone,
      name: bestName,
      contracts,
      reservations: formattedReservations,
      offers: formattedOffers,
      appointments: formattedAppointments,
      messages: formattedMessages
    };

    return res.status(200).json(detail);
  } catch (error) {
    console.error("Eroare la preluarea detaliilor clientului:", error);
    return res.status(500).json({ message: "Eroare la preluarea detaliilor clientului." });
  }
};

module.exports = {
  listCustomers,
  getCustomer,
};
