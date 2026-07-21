const prisma = require("../config/prismaClient");
const {
  toNegotiationDetail,
  toNegotiationSummary
} = require("../utils/networkSerializer");

async function getNegotiationFull(id) {
  return await prisma.tradeNegotiation.findUnique({
    where: { id },
    include: {
      tradeListing: {
        include: {
          listing: {
            include: {
              make: true,
              model: true,
              images: {
                orderBy: {
                  order: 'asc'
                }
              }
            }
          }
        }
      },
      owner: true,
      buyer: true,
      proposals: {
        include: {
          proposer: true,
          offeredListing: {
            include: {
              make: true,
              model: true,
              images: {
                orderBy: {
                  order: 'asc'
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });
}

function isParticipant(n, caller) {
  return n.ownerBusinessId === caller || n.buyerBusinessId === caller;
}

function getLatestProposal(n) {
  if (!n.proposals || n.proposals.length === 0) return null;
  return n.proposals[n.proposals.length - 1];
}

function isRecipientOfPending(n, caller) {
  const latest = getLatestProposal(n);
  return !!(latest && latest.status === 'PENDING' && latest.proposerBusinessId !== caller);
}

// createProposal: body {tradeListingId, kind, offeredPrice?, offeredListingId?, note?}.
const createProposal = async (req, res) => {
  const caller = req.user.businessId;
  const { tradeListingId, kind, offeredPrice, offeredListingId, note } = req.body;

  try {
    const tradeListing = await prisma.networkTradeListing.findUnique({
      where: { id: tradeListingId },
      include: { listing: true, business: true }
    });

    if (!tradeListing || tradeListing.status !== 'ACTIVE' || !tradeListing.listing || tradeListing.listing.status !== 'AVAILABLE') {
      return res.status(404).json({ message: "Mașina nu mai e disponibilă la schimb." });
    }

    const owner = tradeListing.businessId;
    if (owner === caller) {
      return res.status(400).json({ message: "Nu poți face ofertă pe propria mașină." });
    }

    if (kind === 'BUY') {
      if (offeredPrice === undefined || offeredPrice === null || offeredPrice <= 0) {
        return res.status(400).json({ message: "Prețul ofertei e obligatoriu." });
      }
    }

    if (kind === 'EXCHANGE') {
      if (!offeredListingId) {
        return res.status(400).json({ message: "Mașina oferită la schimb este obligatorie." });
      }
    }

    if (offeredListingId) {
      const offeredListing = await prisma.listing.findUnique({
        where: { id: offeredListingId }
      });
      if (!offeredListing || offeredListing.businessId !== caller || offeredListing.status !== 'AVAILABLE') {
        return res.status(400).json({ message: "Mașina oferită la schimb nu e validă." });
      }
    }

    let finalOfferedPrice = offeredPrice;
    if (kind === 'EXCHANGE') {
      finalOfferedPrice = offeredPrice ?? 0;
      if (finalOfferedPrice < 0) {
        return res.status(400).json({ message: "Prețul ofertei nu poate fi negativ." });
      }
    }

    try {
      const negotiation = await prisma.$transaction(async (tx) => {
        const nego = await tx.tradeNegotiation.create({
          data: {
            tradeListingId,
            ownerBusinessId: owner,
            buyerBusinessId: caller,
            status: 'OPEN'
          }
        });

        await tx.tradeProposal.create({
          data: {
            negotiationId: nego.id,
            proposerBusinessId: caller,
            kind,
            offeredPrice: finalOfferedPrice,
            offeredListingId: offeredListingId || null,
            note: note || null,
            status: 'PENDING'
          }
        });

        return nego;
      });

      const reloaded = await getNegotiationFull(negotiation.id);
      reloaded._latest = getLatestProposal(reloaded);
      return res.status(201).json(toNegotiationDetail(reloaded, caller));
    } catch (err) {
      if (err.code === 'P2002') {
        const existing = await prisma.tradeNegotiation.findUnique({
          where: {
            tradeListingId_buyerBusinessId: {
              tradeListingId,
              buyerBusinessId: caller
            }
          }
        });
        return res.status(409).json({
          message: "Ai deja o negociere pentru această mașină.",
          negotiationId: existing?.id || null
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error in createProposal:", error);
    return res.status(500).json({ message: "Eroare la crearea propunerii de negociere." });
  }
};

// listNegotiations: ownerBusinessId=caller OR buyerBusinessId=caller
const listNegotiations = async (req, res) => {
  const caller = req.user.businessId;

  try {
    const negotiations = await prisma.tradeNegotiation.findMany({
      where: {
        OR: [
          { ownerBusinessId: caller },
          { buyerBusinessId: caller }
        ]
      },
      include: {
        tradeListing: {
          include: {
            listing: {
              include: {
                make: true,
                model: true,
                images: { orderBy: { order: 'asc' } }
              }
            }
          }
        },
        owner: true,
        buyer: true,
        proposals: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            proposer: true,
            offeredListing: {
              include: {
                make: true,
                model: true,
                images: { orderBy: { order: 'asc' } }
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const result = negotiations.map(n => {
      n._latest = n.proposals && n.proposals.length > 0 ? n.proposals[0] : null;
      return toNegotiationSummary(n, caller);
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in listNegotiations:", error);
    return res.status(500).json({ message: "Eroare la listarea negocierilor." });
  }
};

// pendingCount: count of caller's negotiations (owner or buyer) that are OPEN and whose latest proposal is PENDING with proposerBusinessId!==caller.
const pendingCount = async (req, res) => {
  const caller = req.user.businessId;

  try {
    const negotiations = await prisma.tradeNegotiation.findMany({
      where: {
        status: 'OPEN',
        OR: [
          { ownerBusinessId: caller },
          { buyerBusinessId: caller }
        ]
      },
      include: {
        proposals: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    const count = negotiations.filter(n => {
      const latest = n.proposals && n.proposals.length > 0 ? n.proposals[0] : null;
      return latest && latest.status === 'PENDING' && latest.proposerBusinessId !== caller;
    }).length;

    return res.status(200).json({ count });
  } catch (error) {
    console.error("Error in pendingCount:", error);
    return res.status(500).json({ message: "Eroare la numărarea negocierilor în așteptare." });
  }
};

// getNegotiation: params id
const getNegotiation = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;

  try {
    const n = await getNegotiationFull(id);
    if (!n || !isParticipant(n, caller)) {
      return res.status(404).json({ message: "Negociere negăsită." });
    }

    n._latest = getLatestProposal(n);
    return res.status(200).json(toNegotiationDetail(n, caller));
  } catch (error) {
    console.error("Error in getNegotiation:", error);
    return res.status(500).json({ message: "Eroare la obținerea negocierii." });
  }
};

// counter: params id, body {kind, offeredPrice?, offeredListingId?, note?}.
const counter = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;
  const { kind, offeredPrice, offeredListingId, note } = req.body;

  try {
    const n = await getNegotiationFull(id);
    if (!n || !isParticipant(n, caller)) {
      return res.status(404).json({ message: "Negociere negăsită." });
    }

    if (n.status !== 'OPEN') {
      return res.status(400).json({ message: "Negocierea nu mai e activă." });
    }

    if (!isRecipientOfPending(n, caller)) {
      return res.status(400).json({ message: "Nu poți contra propria ofertă." });
    }

    if (kind === 'BUY') {
      if (offeredPrice === undefined || offeredPrice === null || offeredPrice <= 0) {
        return res.status(400).json({ message: "Prețul ofertei e obligatoriu." });
      }
    }

    if (kind === 'EXCHANGE') {
      if (!offeredListingId) {
        return res.status(400).json({ message: "Mașina oferită la schimb este obligatorie." });
      }
    }

    if (offeredListingId) {
      const offeredListing = await prisma.listing.findUnique({
        where: { id: offeredListingId }
      });
      if (!offeredListing || offeredListing.businessId !== n.buyerBusinessId || offeredListing.status !== 'AVAILABLE') {
        return res.status(400).json({ message: "Mașina oferită la schimb nu e validă." });
      }
    }

    let finalOfferedPrice = offeredPrice;
    if (kind === 'EXCHANGE') {
      finalOfferedPrice = offeredPrice ?? 0;
      if (finalOfferedPrice < 0) {
        return res.status(400).json({ message: "Prețul ofertei nu poate fi negativ." });
      }
    }

    const latest = getLatestProposal(n);

    await prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.tradeProposal.update({
          where: { id: latest.id },
          data: { status: 'SUPERSEDED' }
        });
      }

      await tx.tradeProposal.create({
        data: {
          negotiationId: n.id,
          proposerBusinessId: caller,
          kind,
          offeredPrice: finalOfferedPrice,
          offeredListingId: offeredListingId || null,
          note: note || null,
          status: 'PENDING'
        }
      });

      await tx.tradeNegotiation.update({
        where: { id: n.id },
        data: { updatedAt: new Date() }
      });
    });

    const reloaded = await getNegotiationFull(n.id);
    reloaded._latest = getLatestProposal(reloaded);
    return res.status(200).json(toNegotiationDetail(reloaded, caller));
  } catch (error) {
    console.error("Error in counter:", error);
    return res.status(500).json({ message: "Eroare la crearea contraofertei." });
  }
};

// accept: params id
const accept = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;

  try {
    const n = await getNegotiationFull(id);
    if (!n || !isParticipant(n, caller)) {
      return res.status(404).json({ message: "Negociere negăsită." });
    }

    if (n.status !== 'OPEN') {
      return res.status(400).json({ message: "Negocierea nu mai e activă." });
    }

    if (!isRecipientOfPending(n, caller)) {
      return res.status(400).json({ message: "Nu poți accepta propria ofertă." });
    }

    const latest = getLatestProposal(n);

    await prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.tradeProposal.update({
          where: { id: latest.id },
          data: { status: 'ACCEPTED' }
        });
      }

      await tx.tradeNegotiation.update({
        where: { id: n.id },
        data: { status: 'ACCEPTED' }
      });

      await tx.networkTradeListing.update({
        where: { id: n.tradeListingId },
        data: { status: 'CLOSED' }
      });

      // SIBLINGS: all OTHER TradeNegotiation on the same tradeListingId with status 'OPEN' -> CANCELLED,
      // and their latest PENDING proposals -> SUPERSEDED
      const openSiblings = await tx.tradeNegotiation.findMany({
        where: {
          tradeListingId: n.tradeListingId,
          status: 'OPEN',
          NOT: { id: n.id }
        },
        include: {
          proposals: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      for (const sibling of openSiblings) {
        await tx.tradeNegotiation.update({
          where: { id: sibling.id },
          data: { status: 'CANCELLED' }
        });

        const sibLatest = sibling.proposals[0];
        if (sibLatest && sibLatest.status === 'PENDING') {
          await tx.tradeProposal.update({
            where: { id: sibLatest.id },
            data: { status: 'SUPERSEDED' }
          });
        }
      }
    });

    const reloaded = await getNegotiationFull(n.id);
    reloaded._latest = getLatestProposal(reloaded);
    return res.status(200).json(toNegotiationDetail(reloaded, caller));
  } catch (error) {
    console.error("Error in accept:", error);
    return res.status(500).json({ message: "Eroare la acceptarea ofertei." });
  }
};

// decline: params id
const decline = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;

  try {
    const n = await getNegotiationFull(id);
    if (!n || !isParticipant(n, caller)) {
      return res.status(404).json({ message: "Negociere negăsită." });
    }

    if (n.status !== 'OPEN') {
      return res.status(400).json({ message: "Negocierea nu mai e activă." });
    }

    if (!isRecipientOfPending(n, caller)) {
      return res.status(400).json({ message: "Nu poți refuza propria ofertă." });
    }

    const latest = getLatestProposal(n);

    await prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.tradeProposal.update({
          where: { id: latest.id },
          data: { status: 'DECLINED' }
        });
      }

      await tx.tradeNegotiation.update({
        where: { id: n.id },
        data: { status: 'DECLINED' }
      });
    });

    const reloaded = await getNegotiationFull(n.id);
    reloaded._latest = getLatestProposal(reloaded);
    return res.status(200).json(toNegotiationDetail(reloaded, caller));
  } catch (error) {
    console.error("Error in decline:", error);
    return res.status(500).json({ message: "Eroare la refuzarea ofertei." });
  }
};

// cancel: params id
const cancel = async (req, res) => {
  const caller = req.user.businessId;
  const { id } = req.params;

  try {
    const n = await getNegotiationFull(id);
    if (!n || !isParticipant(n, caller)) {
      return res.status(404).json({ message: "Negociere negăsită." });
    }

    if (n.status !== 'OPEN') {
      return res.status(400).json({ message: "Negocierea nu mai e activă." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.tradeProposal.updateMany({
        where: {
          negotiationId: n.id,
          status: 'PENDING'
        },
        data: {
          status: 'SUPERSEDED'
        }
      });

      await tx.tradeNegotiation.update({
        where: { id: n.id },
        data: { status: 'CANCELLED' }
      });
    });

    const reloaded = await getNegotiationFull(n.id);
    reloaded._latest = getLatestProposal(reloaded);
    return res.status(200).json(toNegotiationDetail(reloaded, caller));
  } catch (error) {
    console.error("Error in cancel:", error);
    return res.status(500).json({ message: "Eroare la anularea negocierii." });
  }
};

module.exports = {
  createProposal,
  listNegotiations,
  pendingCount,
  getNegotiation,
  counter,
  accept,
  decline,
  cancel
};
