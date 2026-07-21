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

    const [buyers, reservations, appointments, messages] = await Promise.all([
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
        }
      }),
      prisma.message.findMany({
        where: { businessId },
        select: {
          name: true,
          phone: true,
          createdAt: true,
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
          purchasedCars: [],
          lastInteraction: new Date(0),
          sources: new Set(),
        });
      }
      return customerMap.get(normalized);
    };

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

      const apptTime = appt.startAt ? new Date(appt.startAt) : new Date(appt.createdAt);
      if (apptTime > cust.lastInteraction) {
        cust.lastInteraction = apptTime;
      }
      const apptCreated = new Date(appt.createdAt);
      if (apptCreated > cust.lastInteraction) {
        cust.lastInteraction = apptCreated;
      }
    }

    // 4. Messages / Leads
    for (const msg of messages) {
      const cust = getOrCreateCustomer(msg.phone, msg.name);
      if (!cust) continue;

      cust.sources.add("message");
      cust.name = pickName(cust.name, msg.name);
      cust.messagesCount++;

      const msgCreated = new Date(msg.createdAt);
      if (msgCreated > cust.lastInteraction) {
        cust.lastInteraction = msgCreated;
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

    const [buyers, reservations, appointments, messages] = await Promise.all([
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
      })
    ]);

    const matchedBuyers = buyers.filter(b => normalizePhone(b.phone) === targetPhone);
    const matchedReservations = reservations.filter(r => normalizePhone(r.clientPhone) === targetPhone);
    const matchedAppointments = appointments.filter(a => normalizePhone(a.clientPhone) === targetPhone);
    const matchedMessages = messages.filter(m => normalizePhone(m.phone) === targetPhone);

    if (matchedBuyers.length === 0 && matchedReservations.length === 0 && matchedAppointments.length === 0 && matchedMessages.length === 0) {
      return res.status(404).json({ message: "Client negăsit." });
    }

    let bestName = "";
    matchedBuyers.forEach(b => { bestName = pickName(bestName, b.name); });
    matchedReservations.forEach(r => { bestName = pickName(bestName, r.clientName); });
    matchedAppointments.forEach(a => { bestName = pickName(bestName, a.clientName); });
    matchedMessages.forEach(m => { bestName = pickName(bestName, m.name); });

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

    const detail = {
      phone: targetPhone,
      name: bestName,
      contracts,
      reservations: formattedReservations,
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
