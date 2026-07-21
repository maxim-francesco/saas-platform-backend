// src/utils/networkSerializer.js

function toNetworkDealer(business) {
  if (!business) return null;
  return {
    id: business.id,
    name: business.networkDisplayName || business.name,
    city: business.city || null,
    contactPhone: business.networkContactPhone || business.companyPhone || null,
    contactEmail: business.networkContactEmail || business.companyEmail || null,
  };
}

function toNetworkTransportRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    fromCity: run.fromCity,
    toCity: run.toCity,
    departureDate: run.departureDate,
    seatsTotal: run.seatsTotal,
    seatsAvailable: run.seatsAvailable,
    pricePerCar: run.pricePerCar,
    notes: run.notes,
    status: run.status,
    kind: run.kind,
    transportType: run.transportType,
    acceptsNonRunning: run.acceptsNonRunning,
    fromCountry: run.fromCountry,
    departureDateEnd: run.departureDateEnd,
    createdAt: run.createdAt,
    owner: run.business ? toNetworkDealer(run.business) : null,
    interestCount: typeof run._count?.interests === 'number' ? run._count.interests : undefined,
  };
}

function toNetworkTransportInterest(interest) {
  if (!interest) return null;
  return {
    id: interest.id,
    seatsRequested: interest.seatsRequested,
    note: interest.note,
    isSeen: interest.isSeen,
    createdAt: interest.createdAt,
    dealer: interest.business ? toNetworkDealer(interest.business) : null,
  };
}

function toConversationSummary(conv, myBusinessId) {
  if (!conv) return null;
  return {
    id: conv.id,
    contextType: conv.contextType,
    contextId: conv.contextId,
    lastMessageAt: conv.lastMessageAt,
    createdAt: conv.createdAt,
    otherDealer: toNetworkDealer(conv.businessAId === myBusinessId ? conv.businessB : conv.businessA),
    unreadCount: typeof conv._unreadCount === 'number' ? conv._unreadCount : undefined,
    lastMessage: conv._lastMessage ? {
      body: conv._lastMessage.body,
      createdAt: conv._lastMessage.createdAt,
      fromMe: conv._lastMessage.senderBusinessId === myBusinessId
    } : null,
  };
}

function toDealerMessage(msg, myBusinessId) {
  if (!msg) return null;
  return {
    id: msg.id,
    body: msg.body,
    createdAt: msg.createdAt,
    isRead: msg.isRead,
    fromMe: msg.senderBusinessId === myBusinessId,
  };
}
function toTradeListing(tl) {
  if (!tl) return null;
  return {
    id: tl.id,
    listingId: tl.listingId,
    b2bPrice: tl.b2bPrice,
    acceptsTrade: tl.acceptsTrade,
    note: tl.note,
    status: tl.status,
    createdAt: tl.createdAt,
    car: {
      title: tl.listing?.title || null,
      make: tl.listing?.make?.name || null,
      model: tl.listing?.model?.name || null,
      year: tl.listing?.year || null,
      mileage: tl.listing?.mileage || null,
      fuelType: tl.listing?.fuelType || null,
      gearbox: tl.listing?.gearbox || null,
      bodyType: tl.listing?.bodyType || null,
      price: tl.listing?.price || null,
      image: tl.listing?.images?.[0]?.url || null,
    },
    owner: tl.business ? toNetworkDealer(tl.business) : null,
  };
}

module.exports = {
  toNetworkDealer,
  toNetworkTransportRun,
  toNetworkTransportInterest,
  toConversationSummary,
  toDealerMessage,
  toTradeListing,
};
