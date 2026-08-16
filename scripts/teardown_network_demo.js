const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const prisma = new PrismaClient();

const DEMO_BUSINESS_ID = 'cmgnq24pn0081p02egm5pimf0';
const ALPHA_BUSINESS_ID = 'cmrtmaw5a0000vedou3g833vb';

async function run() {
  try {
    // T1. Delete DealerMessage rows whose conversation has businessAId = DEMO OR businessBId = DEMO.
    const t1 = await prisma.dealerMessage.deleteMany({
      where: {
        conversation: {
          OR: [
            { businessAId: DEMO_BUSINESS_ID },
            { businessBId: DEMO_BUSINESS_ID }
          ]
        }
      }
    });
    console.log(`T1=${t1.count}`);

    // T2. Delete Conversation rows where businessAId = DEMO OR businessBId = DEMO.
    const t2 = await prisma.conversation.deleteMany({
      where: {
        OR: [
          { businessAId: DEMO_BUSINESS_ID },
          { businessBId: DEMO_BUSINESS_ID }
        ]
      }
    });
    console.log(`T2=${t2.count}`);

    // T3. Delete TradeProposal rows whose negotiation has ownerBusinessId = DEMO OR buyerBusinessId = DEMO.
    const t3 = await prisma.tradeProposal.deleteMany({
      where: {
        negotiation: {
          OR: [
            { ownerBusinessId: DEMO_BUSINESS_ID },
            { buyerBusinessId: DEMO_BUSINESS_ID }
          ]
        }
      }
    });
    console.log(`T3=${t3.count}`);

    // T4. Delete TradeNegotiation rows where ownerBusinessId = DEMO OR buyerBusinessId = DEMO.
    const t4 = await prisma.tradeNegotiation.deleteMany({
      where: {
        OR: [
          { ownerBusinessId: DEMO_BUSINESS_ID },
          { buyerBusinessId: DEMO_BUSINESS_ID }
        ]
      }
    });
    console.log(`T4=${t4.count}`);

    // T5. Delete NetworkTradeListing rows where businessId = DEMO.
    const t5 = await prisma.networkTradeListing.deleteMany({
      where: {
        businessId: DEMO_BUSINESS_ID
      }
    });
    console.log(`T5=${t5.count}`);

    // T6. Delete TransportInterest rows where businessId = DEMO OR runId IN (SELECT id FROM TransportRun WHERE businessId = DEMO).
    const t6 = await prisma.transportInterest.deleteMany({
      where: {
        OR: [
          { businessId: DEMO_BUSINESS_ID },
          {
            run: {
              businessId: DEMO_BUSINESS_ID
            }
          }
        ]
      }
    });
    console.log(`T6=${t6.count}`);

    // T7. Delete TransportRun rows where businessId = DEMO.
    const t7 = await prisma.transportRun.deleteMany({
      where: {
        businessId: DEMO_BUSINESS_ID
      }
    });
    console.log(`T7=${t7.count}`);

    // T8. Reset network profile fields to null for: DEMO and ALPHA.
    const t8 = await prisma.business.updateMany({
      where: {
        OR: [
          { id: DEMO_BUSINESS_ID },
          { id: ALPHA_BUSINESS_ID }
        ]
      },
      data: {
        city: null,
        networkDisplayName: null,
        networkContactPhone: null,
        networkContactEmail: null
      }
    });
    console.log(`T8=${t8.count}`);

    console.log("TEARDOWN_OK");

  } catch (error) {
    console.error("Execution error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
