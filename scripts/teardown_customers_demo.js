const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const prisma = new PrismaClient();

const businessId = 'cmgnq24pn0081p02egm5pimf0';
const SEED_PHONES = ["0745112233","0721445566","0733887799","0766223344","0788556644"];

async function run() {
  try {
    // ==========================================
    // STEP 1 — DRY REPORT FIRST
    // ==========================================
    const messageCount = await prisma.message.count({
      where: { businessId, phone: { in: SEED_PHONES } }
    });

    const reservationCount = await prisma.reservation.count({
      where: { businessId, clientPhone: { in: SEED_PHONES } }
    });

    const appointmentCount = await prisma.appointment.count({
      where: { businessId, clientPhone: { in: SEED_PHONES } }
    });

    const offerCount = await prisma.offer.count({
      where: { businessId, clientPhone: { in: SEED_PHONES } }
    });

    const buyersToDelete = await prisma.buyer.findMany({
      where: { businessId, phone: { in: SEED_PHONES } },
      select: { id: true }
    });
    const buyerIds = buyersToDelete.map(b => b.id);
    const buyerCount = buyerIds.length;

    const contractCount = await prisma.contract.count({
      where: { businessId, buyerId: { in: buyerIds } }
    });

    console.log(`WOULD DELETE Message: ${messageCount}`);
    console.log(`WOULD DELETE Contract: ${contractCount}`);
    console.log(`WOULD DELETE Buyer: ${buyerCount}`);
    console.log(`WOULD DELETE Reservation: ${reservationCount}`);
    console.log(`WOULD DELETE Appointment: ${appointmentCount}`);
    console.log(`WOULD DELETE Offer: ${offerCount}`);

    const totalToDelete = messageCount + contractCount + buyerCount + reservationCount + appointmentCount + offerCount;
    if (totalToDelete === 0) {
      console.log("NOTHING TO TEAR DOWN");
      process.exit(0);
    }

    // ==========================================
    // STEP 2 — DELETE IN EXACT ORDER
    // ==========================================
    
    // 1. Contract
    const deleteContracts = await prisma.contract.deleteMany({
      where: { businessId, buyerId: { in: buyerIds } }
    });
    console.log(`Deleted Contracts: ${deleteContracts.count}`);

    // 2. Buyer
    const deleteBuyers = await prisma.buyer.deleteMany({
      where: { businessId, phone: { in: SEED_PHONES } }
    });
    console.log(`Deleted Buyers: ${deleteBuyers.count}`);

    // 3. Reservation
    const deleteReservations = await prisma.reservation.deleteMany({
      where: { businessId, clientPhone: { in: SEED_PHONES } }
    });
    console.log(`Deleted Reservations: ${deleteReservations.count}`);

    // 4. Appointment
    const deleteAppointments = await prisma.appointment.deleteMany({
      where: { businessId, clientPhone: { in: SEED_PHONES } }
    });
    console.log(`Deleted Appointments: ${deleteAppointments.count}`);

    // 5. Offer
    const deleteOffers = await prisma.offer.deleteMany({
      where: { businessId, clientPhone: { in: SEED_PHONES } }
    });
    console.log(`Deleted Offers: ${deleteOffers.count}`);

    // 6. Message
    const deleteMessages = await prisma.message.deleteMany({
      where: { businessId, phone: { in: SEED_PHONES } }
    });
    console.log(`Deleted Messages: ${deleteMessages.count}`);

    // ==========================================
    // STEP 3 — RESTORE LISTING STATUS
    // ==========================================
    const listingIds = ['cmrndab770005ve34kfsgstzc', 'cmrnrwjw00001vecov223sfzp'];
    for (const id of listingIds) {
      const listing = await prisma.listing.findUnique({
        where: { id },
        select: { id: true, title: true, status: true }
      });
      if (listing) {
        console.log(`Listing ${id} (${listing.title}) current status: ${listing.status}`);
        if (listing.status === 'RESERVED') {
          const updated = await prisma.listing.update({
            where: { id },
            data: { status: 'AVAILABLE' }
          });
          console.log(`Listing ${id} status updated from RESERVED to ${updated.status}`);
        } else {
          console.log(`Listing ${id} status is ${listing.status}, leaving it alone.`);
        }
      } else {
        console.log(`Listing ${id} not found.`);
      }
    }

    // ==========================================
    // STEP 4 — FINAL COUNTS
    // ==========================================
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

    console.log("BASELINE SHOULD BE: Message 17 · Contract 1 · Buyer 1 · Reservation 1 · Appointment 3 · Offer 5");

  } catch (error) {
    console.error("Execution error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
