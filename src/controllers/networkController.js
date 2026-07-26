// src/controllers/networkController.js
const prisma = require("../config/prismaClient");
const { toNetworkDealer } = require("../utils/networkSerializer");

const getNetworkSettings = async (req, res) => {
  const { businessId } = req.user;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        networkEnabled: true,
        city: true,
        networkDisplayName: true,
        networkContactPhone: true,
        networkContactEmail: true,
        name: true,
      },
    });

    if (!business) {
      return res.status(404).json({ message: "Business-ul nu a fost găsit." });
    }

    return res.status(200).json(business);
  } catch (error) {
    console.error("Eroare getNetworkSettings:", error);
    return res.status(500).json({ message: "Eroare la obținerea setărilor de rețea." });
  }
};

const updateNetworkSettings = async (req, res) => {
  const { businessId } = req.user;
  const { networkEnabled, city, networkDisplayName, networkContactPhone, networkContactEmail } = req.body;

  try {
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        networkEnabled,
        city,
        networkDisplayName,
        networkContactPhone,
        networkContactEmail,
      },
      select: {
        networkEnabled: true,
        city: true,
        networkDisplayName: true,
        networkContactPhone: true,
        networkContactEmail: true,
        name: true,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare updateNetworkSettings:", error);
    return res.status(500).json({ message: "Eroare la actualizarea setărilor de rețea." });
  }
};

const getNetworkDealers = async (req, res) => {
  const { businessId } = req.user;

  try {
    const dealers = await prisma.business.findMany({
      where: {
        networkEnabled: true,
        id: { not: businessId },
      },
    });

    const sanitizedDealers = dealers.map(toNetworkDealer);
    return res.status(200).json(sanitizedDealers);
  } catch (error) {
    console.error("Eroare getNetworkDealers:", error);
    return res.status(500).json({ message: "Eroare la obținerea listei de dealeri." });
  }
};

const getNetworkSummary = async (req, res) => {
  const caller = req.user.businessId;

  try {
    // 1. Counts
    // pendingNegotiations count
    const negotiations = await prisma.tradeNegotiation.findMany({
      where: {
        status: "OPEN",
        OR: [
          { ownerBusinessId: caller },
          { buyerBusinessId: caller }
        ]
      },
      include: {
        owner: true,
        buyer: true,
        tradeListing: {
          include: {
            listing: true
          }
        },
        proposals: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    const pendingNegoList = negotiations.filter(n => {
      const latest = n.proposals && n.proposals.length > 0 ? n.proposals[0] : null;
      return latest && latest.status === "PENDING" && latest.proposerBusinessId !== caller;
    });

    const pendingNegotiationsCount = pendingNegoList.length;

    // unreadMessages count
    const unreadMessagesCount = await prisma.dealerMessage.count({
      where: {
        isRead: false,
        senderBusinessId: { not: caller },
        conversation: {
          OR: [
            { businessAId: caller },
            { businessBId: caller }
          ]
        }
      }
    });

    // newTransportInterests count
    const newTransportInterestsCount = await prisma.transportInterest.count({
      where: {
        isSeen: false,
        run: {
          businessId: caller,
        },
      },
    });

    // browseCars count
    const browseCarsCount = await prisma.networkTradeListing.count({
      where: {
        status: "ACTIVE",
        businessId: { not: caller },
        listing: {
          status: "AVAILABLE",
        },
      },
    });

    // myExposedCars count
    const myExposedCarsCount = await prisma.networkTradeListing.count({
      where: {
        businessId: caller,
        status: "ACTIVE",
      },
    });

    // browseRuns count
    const browseRunsCount = await prisma.transportRun.count({
      where: {
        status: "OPEN",
        departureDate: { gte: new Date() },
        businessId: { not: caller },
      },
    });

    // myRuns count
    const myRunsCount = await prisma.transportRun.count({
      where: {
        businessId: caller,
      },
    });

    // dealers count
    const dealersCount = await prisma.business.count({
      where: {
        networkEnabled: true,
        id: { not: caller },
      },
    });

    // conversations count
    const conversationsCount = await prisma.conversation.count({
      where: {
        OR: [
          { businessAId: caller },
          { businessBId: caller }
        ]
      },
    });

    // 2. Action Items
    // A) Negotiations
    const negotiationActionItems = pendingNegoList.map(n => {
      const latest = n.proposals[0];
      const counterparty = n.ownerBusinessId === caller ? n.buyer : n.owner;
      return {
        type: "NEGOTIATION",
        id: n.id,
        dealerName: counterparty.networkDisplayName || counterparty.name,
        carTitle: n.tradeListing?.listing?.title || null,
        amount: latest.offeredPrice,
        proposalKind: latest.kind,
        role: n.ownerBusinessId === caller ? "SELLER" : "BUYER",
        when: latest.createdAt.toISOString()
      };
    });

    // B) Conversations with unread messages
    const allConversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { businessAId: caller },
          { businessBId: caller }
        ]
      },
      include: {
        businessA: true,
        businessB: true
      }
    });

    const messageActionItems = [];
    for (const conv of allConversations) {
      const unreadCount = await prisma.dealerMessage.count({
        where: {
          conversationId: conv.id,
          senderBusinessId: { not: caller },
          isRead: false
        }
      });

      if (unreadCount > 0) {
        const lastMsg = await prisma.dealerMessage.findFirst({
          where: { conversationId: conv.id },
          orderBy: { createdAt: "desc" }
        });

        if (lastMsg) {
          const otherParty = conv.businessAId === caller ? conv.businessB : conv.businessA;
          messageActionItems.push({
            type: "MESSAGE",
            id: conv.id,
            dealerName: otherParty.networkDisplayName || otherParty.name,
            preview: lastMsg.body,
            unreadCount,
            when: lastMsg.createdAt.toISOString()
          });
        }
      }
    }

    // C) Transport interests
    const myTransportRuns = await prisma.transportRun.findMany({
      where: {
        businessId: caller
      },
      include: {
        interests: {
          where: {
            isSeen: false
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    const transportActionItems = myTransportRuns
      .filter(run => run.interests.length > 0)
      .map(run => ({
        type: "TRANSPORT_INTEREST",
        id: run.id,
        fromCity: run.fromCity,
        toCity: run.toCity,
        departureDate: run.departureDate.toISOString(),
        interestedCount: run.interests.length,
        when: run.interests[0].createdAt.toISOString()
      }));

    // Merge and sort
    const mergedActionItems = [
      ...negotiationActionItems,
      ...messageActionItems,
      ...transportActionItems
    ];

    mergedActionItems.sort((a, b) => new Date(b.when) - new Date(a.when));

    return res.status(200).json({
      counts: {
        pendingNegotiations: pendingNegotiationsCount,
        unreadMessages: unreadMessagesCount,
        newTransportInterests: newTransportInterestsCount,
        browseCars: browseCarsCount,
        myExposedCars: myExposedCarsCount,
        browseRuns: browseRunsCount,
        myRuns: myRunsCount,
        dealers: dealersCount,
        conversations: conversationsCount
      },
      actionItems: mergedActionItems
    });
  } catch (error) {
    console.error("Eroare getNetworkSummary:", error);
    return res.status(500).json({ message: "Eroare la obținerea rezumatului rețelei." });
  }
};

module.exports = {
  getNetworkSettings,
  updateNetworkSettings,
  getNetworkDealers,
  getNetworkSummary,
};
