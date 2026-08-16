const axios = require('axios');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:4400';

async function run() {
  try {
    // 1. Authenticate
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'demo.auto@email.com',
      password: 'Test1234!'
    });
    const token = loginRes.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. Double-run guard
    const seedPhones = ["0745112233", "0721445566", "0733887799", "0766223344", "0788556644"];
    const existingMessage = await prisma.message.findFirst({
      where: {
        phone: { in: seedPhones }
      }
    });

    if (existingMessage) {
      console.log("SEED ALREADY APPLIED — ABORTING");
      process.exit(0);
    }

    // ==========================================
    // P1 — Gheorghe Vasilescu
    // ==========================================
    
    // msg1
    const p1_msg1Res = await axios.post(`${BASE_URL}/api/messages`, {
      name: "Gheorghe Vasilescu",
      phone: "0745112233",
      email: "gheorghe.vasilescu@gmail.com",
      message: "Buna ziua, ma intereseaza Skoda Octavia. Este disponibila?",
      type: "STOCK",
      listingId: "cmgnqbkql00ctp02e2cjhsgnu"
    }, { headers: authHeaders });
    const p1_msg1Id = p1_msg1Res.data.id;
    
    await axios.patch(`${BASE_URL}/api/messages/${p1_msg1Id}/status`, {
      status: "CONTACTED"
    }, { headers: authHeaders });

    await prisma.message.update({
      where: { id: p1_msg1Id },
      data: { createdAt: new Date("2026-06-13T09:20:00Z") }
    });

    // appt1
    const p1_appt1Res = await axios.post(`${BASE_URL}/api/appointments`, {
      title: "Vizionare Skoda Octavia",
      type: "VIEWING",
      startAt: "2026-06-16T14:00:00Z",
      endAt: "2026-06-16T15:00:00Z",
      clientName: "Gheorghe Vasilescu",
      clientPhone: "0745112233",
      listingId: "cmgnqbkql00ctp02e2cjhsgnu"
    }, { headers: authHeaders });
    const p1_appt1Id = p1_appt1Res.data.id;

    await axios.patch(`${BASE_URL}/api/appointments/${p1_appt1Id}`, {
      status: "COMPLETED"
    }, { headers: authHeaders });

    await prisma.appointment.update({
      where: { id: p1_appt1Id },
      data: { createdAt: new Date("2026-06-13T10:00:00Z") }
    });

    // contract
    let p1_contractId;
    try {
      const p1_contractRes = await axios.post(`${BASE_URL}/api/contracts`, {
        listingId: "cmgnqbkql00ctp02e2cjhsgnu",
        buyerType: "INDIVIDUAL",
        buyerName: "Gheorghe Vasilescu",
        buyerAddress: "Str. Mihai Viteazu 12, Cluj-Napoca",
        buyerPhone: "0745112233",
        buyerEmail: "gheorghe.vasilescu@gmail.com",
        buyerCnp: "1880412125634",
        buyerCiSeries: "CJ",
        buyerCiNumber: "334512",
        plateNumber: "CJ 12 GVA",
        mileageAtSale: 145000,
        salePrice: 19500,
        saleDate: "2026-06-18"
      }, { headers: authHeaders });
      p1_contractId = p1_contractRes.data.id;
    } catch (error) {
      if (error.response) {
        console.error("CONTRACT REJECTION DETAILS:");
        console.error(`URL: ${BASE_URL}/api/contracts`);
        console.error(`Status: ${error.response.status}`);
        console.error("Response Body:", JSON.stringify(error.response.data));
      } else {
        console.error("CONTRACT REJECTION ERROR:", error.message);
      }
      process.exit(1);
    }

    await prisma.contract.update({
      where: { id: p1_contractId },
      data: { createdAt: new Date("2026-06-18T11:30:00Z") }
    });

    const p1_contractDb = await prisma.contract.findUnique({
      where: { id: p1_contractId },
      select: { buyerId: true }
    });
    const p1_buyerId = p1_contractDb.buyerId;

    await prisma.buyer.update({
      where: { id: p1_buyerId },
      data: { createdAt: new Date("2026-06-18T11:30:00Z") }
    });

    // appt2
    const p1_appt2Res = await axios.post(`${BASE_URL}/api/appointments`, {
      title: "Predare Skoda Octavia",
      type: "HANDOVER",
      startAt: "2026-06-20T10:00:00Z",
      endAt: "2026-06-20T11:00:00Z",
      clientName: "Gheorghe Vasilescu",
      clientPhone: "0745112233",
      listingId: "cmgnqbkql00ctp02e2cjhsgnu"
    }, { headers: authHeaders });
    const p1_appt2Id = p1_appt2Res.data.id;

    await axios.patch(`${BASE_URL}/api/appointments/${p1_appt2Id}`, {
      status: "COMPLETED"
    }, { headers: authHeaders });

    await prisma.appointment.update({
      where: { id: p1_appt2Id },
      data: { createdAt: new Date("2026-06-18T12:00:00Z") }
    });

    // msg2
    const p1_msg2Res = await axios.post(`${BASE_URL}/api/messages`, {
      name: "Gheorghe Vasilescu",
      phone: "0745112233",
      email: "gheorghe.vasilescu@gmail.com",
      message: "Salut, caut si un SUV pentru sotie. Ce aveti in stoc?",
      type: "GENERAL",
      listingId: null
    }, { headers: authHeaders });
    const p1_msg2Id = p1_msg2Res.data.id;

    await axios.patch(`${BASE_URL}/api/messages/${p1_msg2Id}/status`, {
      status: "CONTACTED"
    }, { headers: authHeaders });

    await prisma.message.update({
      where: { id: p1_msg2Id },
      data: { createdAt: new Date("2026-07-18T16:45:00Z") }
    });

    // offer
    const p1_offerRes = await axios.post(`${BASE_URL}/api/offers`, {
      listingId: "cmrndab770005ve34kfsgstzc",
      clientName: "Gheorghe Vasilescu",
      clientPhone: "0745112233",
      offerPrice: 16000,
      listPrice: 16900,
      validityDays: 7
    }, { headers: authHeaders });
    const p1_offerToken = p1_offerRes.data.token;

    const p1_offerDb = await prisma.offer.findUnique({
      where: { token: p1_offerToken },
      select: { id: true }
    });
    const p1_offerId = p1_offerDb.id;

    await prisma.offer.update({
      where: { id: p1_offerId },
      data: {
        createdAt: new Date("2026-07-19T10:00:00Z"),
        expiresAt: new Date("2026-07-26T10:00:00Z"),
        viewedAt: new Date("2026-07-20T08:15:00Z")
      }
    });

    // resv
    const p1_resvRes = await axios.post(`${BASE_URL}/api/reservations`, {
      listingId: "cmrndab770005ve34kfsgstzc",
      clientName: "Gheorghe Vasilescu",
      clientPhone: "0745112233",
      depositAmount: 1000,
      reservationDays: 7
    }, { headers: authHeaders });
    const p1_resvId = p1_resvRes.data.id;

    await prisma.reservation.update({
      where: { id: p1_resvId },
      data: {
        status: "ACTIVE",
        createdAt: new Date("2026-07-21T12:00:00Z"),
        startDate: new Date("2026-07-21T12:00:00Z"),
        expiresAt: new Date("2026-07-28T12:00:00Z")
      }
    });

    console.log("Gheorghe Vasilescu:");
    console.log(`  Message 1: ${p1_msg1Id}`);
    console.log(`  Appointment 1: ${p1_appt1Id}`);
    console.log(`  Contract: ${p1_contractId}`);
    console.log(`  Buyer: ${p1_buyerId}`);
    console.log(`  Appointment 2: ${p1_appt2Id}`);
    console.log(`  Message 2: ${p1_msg2Id}`);
    console.log(`  Offer: ${p1_offerId}`);
    console.log(`  Reservation: ${p1_resvId}`);

    // ==========================================
    // P2 — Andreea Munteanu
    // ==========================================

    // msg
    const p2_msgRes = await axios.post(`${BASE_URL}/api/messages`, {
      name: "Andreea Munteanu",
      phone: "0721445566",
      email: "andreea.munteanu@yahoo.com",
      message: "Buna, as vrea sa vad Tesla Model X. Se poate un test drive?",
      type: "STOCK",
      listingId: "cmrnrwjwh0003veco33t9h2i5"
    }, { headers: authHeaders });
    const p2_msgId = p2_msgRes.data.id;

    await axios.patch(`${BASE_URL}/api/messages/${p2_msgId}/status`, {
      status: "VIEWING"
    }, { headers: authHeaders });

    await prisma.message.update({
      where: { id: p2_msgId },
      data: { createdAt: new Date("2026-07-15T11:00:00Z") }
    });

    // offer
    const p2_offerRes = await axios.post(`${BASE_URL}/api/offers`, {
      listingId: "cmrnrwjwh0003veco33t9h2i5",
      clientName: "Andreea Munteanu",
      clientPhone: "0721445566",
      offerPrice: 55000,
      listPrice: 58000,
      validityDays: 5
    }, { headers: authHeaders });
    const p2_offerToken = p2_offerRes.data.token;

    const p2_offerDb = await prisma.offer.findUnique({
      where: { token: p2_offerToken },
      select: { id: true }
    });
    const p2_offerId = p2_offerDb.id;

    await prisma.offer.update({
      where: { id: p2_offerId },
      data: {
        createdAt: new Date("2026-07-21T09:00:00Z"),
        expiresAt: new Date("2026-07-26T09:00:00Z"),
        viewedAt: new Date("2026-07-22T19:30:00Z")
      }
    });

    // appt
    const p2_apptRes = await axios.post(`${BASE_URL}/api/appointments`, {
      title: "Test drive Tesla Model X",
      type: "TEST_DRIVE",
      startAt: "2026-07-24T08:00:00Z",
      endAt: "2026-07-24T09:00:00Z",
      clientName: "Andreea Munteanu",
      clientPhone: "0721445566",
      listingId: "cmrnrwjwh0003veco33t9h2i5"
    }, { headers: authHeaders });
    const p2_apptId = p2_apptRes.data.id;

    await prisma.appointment.update({
      where: { id: p2_apptId },
      data: { createdAt: new Date("2026-07-22T20:00:00Z") }
    });

    console.log("Andreea Munteanu:");
    console.log(`  Message: ${p2_msgId}`);
    console.log(`  Offer: ${p2_offerId}`);
    console.log(`  Appointment: ${p2_apptId}`);

    // ==========================================
    // P3 — Cristian Dobre
    // ==========================================

    // msg
    const p3_msgRes = await axios.post(`${BASE_URL}/api/messages`, {
      name: "Cristian Dobre",
      phone: "0733887799",
      email: "cristian.dobre@gmail.com",
      message: "Ma intereseaza Tiguanul. Se poate rezerva pana strang banii?",
      type: "STOCK",
      listingId: "cmrnrwjw00001vecov223sfzp"
    }, { headers: authHeaders });
    const p3_msgId = p3_msgRes.data.id;

    await axios.patch(`${BASE_URL}/api/messages/${p3_msgId}/status`, {
      status: "OFFER"
    }, { headers: authHeaders });

    await prisma.message.update({
      where: { id: p3_msgId },
      data: { createdAt: new Date("2026-07-10T13:00:00Z") }
    });

    // resv
    const p3_resvRes = await axios.post(`${BASE_URL}/api/reservations`, {
      listingId: "cmrnrwjw00001vecov223sfzp",
      clientName: "Cristian Dobre",
      clientPhone: "0733887799",
      depositAmount: 500,
      reservationDays: 7
    }, { headers: authHeaders });
    const p3_resvId = p3_resvRes.data.id;

    await prisma.reservation.update({
      where: { id: p3_resvId },
      data: {
        status: "ACTIVE",
        createdAt: new Date("2026-07-17T10:00:00Z"),
        startDate: new Date("2026-07-17T10:00:00Z"),
        expiresAt: new Date("2026-07-24T10:00:00Z")
      }
    });

    console.log("Cristian Dobre:");
    console.log(`  Message: ${p3_msgId}`);
    console.log(`  Reservation: ${p3_resvId}`);

    // ==========================================
    // P4 — Mihaela Stanciu
    // ==========================================

    // contract
    let p4_contractId;
    try {
      const p4_contractRes = await axios.post(`${BASE_URL}/api/contracts`, {
        listingId: "cmgnqaw84009hp02epav8vq4u",
        buyerType: "INDIVIDUAL",
        buyerName: "Mihaela Stanciu",
        buyerAddress: "Str. Dorobantilor 45, Cluj-Napoca",
        buyerPhone: "0766223344",
        buyerEmail: "mihaela.stanciu@gmail.com",
        buyerCnp: "2900623125478",
        buyerCiSeries: "CJ",
        buyerCiNumber: "221845",
        plateNumber: "CJ 88 MST",
        mileageAtSale: 62000,
        salePrice: 19000,
        saleDate: "2025-11-14"
      }, { headers: authHeaders });
      p4_contractId = p4_contractRes.data.id;
    } catch (error) {
      if (error.response) {
        console.error("CONTRACT REJECTION DETAILS:");
        console.error(`URL: ${BASE_URL}/api/contracts`);
        console.error(`Status: ${error.response.status}`);
        console.error("Response Body:", JSON.stringify(error.response.data));
      } else {
        console.error("CONTRACT REJECTION ERROR:", error.message);
      }
      process.exit(1);
    }

    await prisma.contract.update({
      where: { id: p4_contractId },
      data: { createdAt: new Date("2025-11-14T10:00:00Z") }
    });

    const p4_contractDb = await prisma.contract.findUnique({
      where: { id: p4_contractId },
      select: { buyerId: true }
    });
    const p4_buyerId = p4_contractDb.buyerId;

    await prisma.buyer.update({
      where: { id: p4_buyerId },
      data: { createdAt: new Date("2025-11-14T10:00:00Z") }
    });

    // msg
    const p4_msgRes = await axios.post(`${BASE_URL}/api/messages`, {
      name: "Mihaela Stanciu",
      phone: "0766223344",
      email: "mihaela.stanciu@gmail.com",
      message: "Buna ziua, am cumparat un Duster de la dvs. Il preluati inapoi?",
      type: "BUYBACK",
      listingId: null
    }, { headers: authHeaders });
    const p4_msgId = p4_msgRes.data.id;

    await axios.patch(`${BASE_URL}/api/messages/${p4_msgId}/status`, {
      status: "NEW"
    }, { headers: authHeaders });

    await prisma.message.update({
      where: { id: p4_msgId },
      data: { createdAt: new Date("2026-07-21T18:00:00Z") }
    });

    console.log("Mihaela Stanciu:");
    console.log(`  Contract: ${p4_contractId}`);
    console.log(`  Buyer: ${p4_buyerId}`);
    console.log(`  Message: ${p4_msgId}`);

    // ==========================================
    // P5 — Bogdan Iliescu
    // ==========================================

    // msg
    const p5_msgRes = await axios.post(`${BASE_URL}/api/messages`, {
      name: "Bogdan Iliescu",
      phone: "0788556644",
      email: "bogdan.iliescu@gmail.com",
      message: "Cat e ultimul pret la Golf? Am gasit unul mai ieftin.",
      type: "STOCK",
      listingId: "cmrndab6m0003ve3484uetlre"
    }, { headers: authHeaders });
    const p5_msgId = p5_msgRes.data.id;

    await axios.patch(`${BASE_URL}/api/messages/${p5_msgId}/status`, {
      status: "LOST",
      lostReason: "PRICE"
    }, { headers: authHeaders });

    await prisma.message.update({
      where: { id: p5_msgId },
      data: { createdAt: new Date("2026-06-28T15:00:00Z") }
    });

    // offer
    const p5_offerRes = await axios.post(`${BASE_URL}/api/offers`, {
      listingId: "cmrndab6m0003ve3484uetlre",
      clientName: "Bogdan Iliescu",
      clientPhone: "0788556644",
      offerPrice: 13800,
      listPrice: 14500,
      validityDays: 5
    }, { headers: authHeaders });
    const p5_offerToken = p5_offerRes.data.token;

    const p5_offerDb = await prisma.offer.findUnique({
      where: { token: p5_offerToken },
      select: { id: true }
    });
    const p5_offerId = p5_offerDb.id;

    await prisma.offer.update({
      where: { id: p5_offerId },
      data: {
        createdAt: new Date("2026-06-30T12:00:00Z"),
        expiresAt: new Date("2026-07-05T12:00:00Z"),
        viewedAt: null
      }
    });

    console.log("Bogdan Iliescu:");
    console.log(`  Message: ${p5_msgId}`);
    console.log(`  Offer: ${p5_offerId}`);

    // ==========================================
    // Final counts
    // ==========================================
    const businessId = "cmgnq24pn0081p02egm5pimf0";
    const finalMessageCount = await prisma.message.count({ where: { businessId } });
    const finalContractCount = await prisma.contract.count({ where: { businessId } });
    const finalBuyerCount = await prisma.buyer.count({ where: { businessId } });
    const finalReservationCount = await prisma.reservation.count({ where: { businessId } });
    const finalAppointmentCount = await prisma.appointment.count({ where: { businessId } });
    const finalOfferCount = await prisma.offer.count({ where: { businessId } });

    console.log(`Message: ${finalMessageCount}`);
    console.log(`Contract: ${finalContractCount}`);
    console.log(`Buyer: ${finalBuyerCount}`);
    console.log(`Reservation: ${finalReservationCount}`);
    console.log(`Appointment: ${finalAppointmentCount}`);
    console.log(`Offer: ${finalOfferCount}`);

  } catch (error) {
    console.error("Execution error:", error.response ? error.response.data : error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
