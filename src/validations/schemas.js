// src/validations/schemas.js
const Joi = require("joi");

// --- AUTH ---
const registerSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email({ tlds: { allow: false } }).max(255).required(),
  password: Joi.string().min(6).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).max(255).required(),
  password: Joi.string().max(128).required(),
});

// --- CATEGORIES ---
const categorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

// --- ATTRIBUTES ---
const attributeSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string().valid("STRING", "NUMBER", "BOOLEAN").required(),
  attributeGroupId: Joi.string().max(100).allow(null, "").optional(),
});

// --- LISTINGS ---
const FUEL_TYPES = ["PETROL", "DIESEL", "PETROL_LPG", "LPG", "HYBRID", "PLUGIN_HYBRID", "MILD_HYBRID", "ELECTRIC"];
const GEARBOX_TYPES = ["MANUAL", "AUTOMATIC"];
const DRIVETRAINS = ["FWD", "RWD", "AWD"];
const BODY_TYPES = ["SUV", "SEDAN", "HATCHBACK", "BREAK", "COUPE", "CABRIO", "MONOVOLUM", "VAN", "PICKUP"];
const POLLUTION_NORMS = ["NON_EURO", "EURO_1", "EURO_2", "EURO_3", "EURO_4", "EURO_5", "EURO_6", "EURO_6D"];
const COLORS = ["BLACK", "GREY", "WHITE", "BLUE", "RED", "BROWN", "SILVER", "ORANGE", "GREEN", "PURPLE", "GOLD", "BEIGE", "YELLOW", "OTHER"];
const UPHOLSTERIES = ["FABRIC", "VELOUR", "LEATHER", "PARTIAL_LEATHER", "ALCANTARA"];
const AIR_CONDITIONINGS = ["NONE", "MANUAL", "AUTOMATIC", "DUAL_ZONE", "TRI_ZONE", "QUAD_ZONE"];
const LISTING_STATUSES = ["INCOMING", "AVAILABLE", "RESERVED", "SOLD"];

const createListingSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().max(5000).allow(null, "").optional(),
  internalNotes: Joi.string().max(5000).allow(null, "").optional(),
  makeId: Joi.string().max(100).allow(null).optional(),
  modelId: Joi.string().max(100).allow(null).optional(),
  variant: Joi.string().max(200).allow(null, "").optional(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 2).allow(null).optional(),
  mileage: Joi.number().integer().min(0).allow(null).optional(),
  vin: Joi.string().max(100).allow(null, "").optional(),
  firstRegistrationAt: Joi.date().iso().allow(null).optional(),
  countryOfOrigin: Joi.string().length(2).uppercase().allow(null, "").optional(),
  registeredInRo: Joi.boolean().allow(null).optional(),
  fuelType: Joi.string().valid(...FUEL_TYPES).allow(null).optional(),
  gearbox: Joi.string().valid(...GEARBOX_TYPES).allow(null).optional(),
  drivetrain: Joi.string().valid(...DRIVETRAINS).allow(null).optional(),
  bodyType: Joi.string().valid(...BODY_TYPES).allow(null).optional(),
  engineCapacity: Joi.number().integer().min(0).allow(null).optional(),
  powerHp: Joi.number().integer().min(0).allow(null).optional(),
  pollutionNorm: Joi.string().valid(...POLLUTION_NORMS).allow(null).optional(),
  co2Emissions: Joi.number().integer().min(0).allow(null).optional(),
  color: Joi.string().valid(...COLORS).allow(null).optional(),
  colorDetail: Joi.string().max(200).allow(null, "").optional(),
  upholstery: Joi.string().valid(...UPHOLSTERIES).allow(null).optional(),
  airConditioning: Joi.string().valid(...AIR_CONDITIONINGS).allow(null).optional(),
  doors: Joi.number().integer().min(0).allow(null).optional(),
  seats: Joi.number().integer().min(0).allow(null).optional(),
  vatDeductible: Joi.boolean().allow(null).optional(),
  noAccidents: Joi.boolean().allow(null).optional(),
  serviceBook: Joi.boolean().allow(null).optional(),
  firstOwner: Joi.boolean().allow(null).optional(),
  ownerCount: Joi.number().integer().min(0).allow(null).optional(),
  warrantyMonths: Joi.number().integer().min(0).allow(null).optional(),
  price: Joi.number().min(0).allow(null).optional(),
  purchasePrice: Joi.number().min(0).allow(null).optional(),
  sellingPrice: Joi.number().min(0).allow(null).optional(),
  otherCosts: Joi.number().min(0).allow(null).optional(),
  status: Joi.string().valid(...LISTING_STATUSES).allow(null).optional(),
  youtubeVideoId: Joi.string().max(500).allow(null, "").optional(),
  featureIds: Joi.array().items(Joi.string()).default([]).optional(),
  extraSpecs: Joi.object().unknown(true).allow(null).optional(),
});

const updateListingSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).optional(),
  description: Joi.string().max(5000).allow(null, "").optional(),
  internalNotes: Joi.string().max(5000).allow(null, "").optional(),
  makeId: Joi.string().max(100).allow(null).optional(),
  modelId: Joi.string().max(100).allow(null).optional(),
  variant: Joi.string().max(200).allow(null, "").optional(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 2).allow(null).optional(),
  mileage: Joi.number().integer().min(0).allow(null).optional(),
  vin: Joi.string().max(100).allow(null, "").optional(),
  firstRegistrationAt: Joi.date().iso().allow(null).optional(),
  countryOfOrigin: Joi.string().length(2).uppercase().allow(null, "").optional(),
  registeredInRo: Joi.boolean().allow(null).optional(),
  fuelType: Joi.string().valid(...FUEL_TYPES).allow(null).optional(),
  gearbox: Joi.string().valid(...GEARBOX_TYPES).allow(null).optional(),
  drivetrain: Joi.string().valid(...DRIVETRAINS).allow(null).optional(),
  bodyType: Joi.string().valid(...BODY_TYPES).allow(null).optional(),
  engineCapacity: Joi.number().integer().min(0).allow(null).optional(),
  powerHp: Joi.number().integer().min(0).allow(null).optional(),
  pollutionNorm: Joi.string().valid(...POLLUTION_NORMS).allow(null).optional(),
  co2Emissions: Joi.number().integer().min(0).allow(null).optional(),
  color: Joi.string().valid(...COLORS).allow(null).optional(),
  colorDetail: Joi.string().max(200).allow(null, "").optional(),
  upholstery: Joi.string().valid(...UPHOLSTERIES).allow(null).optional(),
  airConditioning: Joi.string().valid(...AIR_CONDITIONINGS).allow(null).optional(),
  doors: Joi.number().integer().min(0).allow(null).optional(),
  seats: Joi.number().integer().min(0).allow(null).optional(),
  vatDeductible: Joi.boolean().allow(null).optional(),
  noAccidents: Joi.boolean().allow(null).optional(),
  serviceBook: Joi.boolean().allow(null).optional(),
  firstOwner: Joi.boolean().allow(null).optional(),
  ownerCount: Joi.number().integer().min(0).allow(null).optional(),
  warrantyMonths: Joi.number().integer().min(0).allow(null).optional(),
  price: Joi.number().min(0).allow(null).optional(),
  purchasePrice: Joi.number().min(0).allow(null).optional(),
  sellingPrice: Joi.number().min(0).allow(null).optional(),
  otherCosts: Joi.number().min(0).allow(null).optional(),
  status: Joi.string().valid(...LISTING_STATUSES).allow(null).optional(),
  youtubeVideoId: Joi.string().max(500).allow(null, "").optional(),
  featureIds: Joi.array().items(Joi.string()).default([]).optional(),
  extraSpecs: Joi.object().unknown(true).allow(null).optional(),
});

const markAsSoldSchema = Joi.object({
  sellingPrice: Joi.number().min(0).required(),
  soldAt: Joi.date().iso().required(),
});

// --- CONTACT ---
const contactFormSchema = Joi.object({
  businessId: Joi.string().required(),
  name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email().max(255).required(),
  phone: Joi.string().max(20).allow(null, "").optional(),
  message: Joi.string().trim().min(1).max(2000).required(),
  type: Joi.string().valid("GENERAL", "STOCK", "ORDER", "BUYBACK").default("GENERAL").optional(),
  listingId: Joi.string().allow(null, "").optional(),
});

// --- REVIEWS ---
const reviewSchema = Joi.object({
  businessId: Joi.string().required(),
  name: Joi.string().trim().min(1).max(100).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  text: Joi.string().trim().min(1).max(1000).required(),
});

// --- BUSINESS PROFILE ---
const updateProfileSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().max(255).optional(),
  password: Joi.string().min(6).max(128).allow(null, "").optional(),
});

const updateSettingsSchema = Joi.object({
  listingUrlPattern: Joi.string().max(500).allow(null, "").optional(),
});

const updateIdentitySchema = Joi.object({
  companyPhone:    Joi.string().max(30).allow(null, "").optional(),
  companyEmail:    Joi.string().email().max(255).allow(null, "").optional(),
  companyAddress:  Joi.string().max(500).allow(null, "").optional(),
  companyCui:      Joi.string().max(50).allow(null, "").optional(),
  companyRegCom:   Joi.string().max(50).allow(null, "").optional(),
  companyLegalRep: Joi.string().max(150).allow(null, "").optional(),
});

// --- ATTRIBUTE GROUPS ---
const attributeGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

const assignAttributesSchema = Joi.object({
  attributeIds: Joi.array().items(Joi.string()).min(1).required(),
});

const createManualLeadSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  email: Joi.string().email().max(255).allow(null, "").optional(),
  phone: Joi.string().trim().min(1).max(20).required(),
  message: Joi.string().trim().min(1).max(2000).allow(null, "").optional(),
  type: Joi.string().valid("GENERAL", "STOCK", "ORDER", "BUYBACK").default("GENERAL").optional(),
  listingId: Joi.string().allow(null, "").optional(),
});

const createOfferSchema = Joi.object({
  listingId:    Joi.string().max(100).required(),
  clientName:   Joi.string().trim().min(2).max(150).required(),
  clientPhone:  Joi.string().trim().min(4).max(30).required(),
  offerPrice:   Joi.number().min(0).required(),
  listPrice:    Joi.number().min(0).allow(null).optional(),
  validityDays: Joi.number().integer().min(1).max(90).default(5),
});

const createContractSchema = Joi.object({
  listingId:     Joi.string().max(100).required(),
  buyerType:     Joi.string().valid("INDIVIDUAL", "COMPANY").required(),
  buyerName:     Joi.string().trim().min(2).max(200).required(),
  buyerAddress:  Joi.string().trim().max(500).allow(null, "").optional(),
  buyerPhone:    Joi.string().trim().max(30).allow(null, "").optional(),
  buyerEmail:    Joi.string().email().max(255).allow(null, "").optional(),
  buyerCnp:      Joi.string().trim().max(20).allow(null, "").optional(),
  buyerCiSeries: Joi.string().trim().max(10).allow(null, "").optional(),
  buyerCiNumber: Joi.string().trim().max(20).allow(null, "").optional(),
  buyerCui:      Joi.string().trim().max(50).allow(null, "").optional(),
  buyerRegCom:   Joi.string().trim().max(50).allow(null, "").optional(),
  buyerLegalRep: Joi.string().trim().max(150).allow(null, "").optional(),
  salePrice:     Joi.number().min(0).required(),
  saleDate:      Joi.date().iso().required(),
  plateNumber:   Joi.string().trim().max(20).allow(null, "").optional(),
  mileageAtSale: Joi.number().integer().min(0).allow(null).optional(),
  clauses:       Joi.string().max(10000).allow(null, "").optional(),
});

const handoverSchema = Joi.object({
  handoverDate:    Joi.date().iso().allow(null).optional(),
  handoverMileage: Joi.number().integer().min(0).allow(null).optional(),
  handoverNotes:   Joi.string().max(5000).allow(null, "").optional(),
  handoverItems:   Joi.object().unknown(true).allow(null).optional(),
});

const createReservationSchema = Joi.object({
  listingId:     Joi.string().max(100).required(),
  clientName:    Joi.string().trim().min(2).max(150).required(),
  clientPhone:   Joi.string().trim().min(4).max(30).required(),
  depositAmount: Joi.number().min(0).required(),
  reservationDays: Joi.number().integer().min(1).max(365).default(7),
});

const createAppointmentSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().valid("TEST_DRIVE","VIEWING","HANDOVER","MEETING","OTHER").default("OTHER"),
  startAt: Joi.date().iso().required(),
  endAt: Joi.date().iso().required(),
  clientName: Joi.string().trim().max(150).allow(null, "").optional(),
  clientPhone: Joi.string().trim().max(30).allow(null, "").optional(),
  listingId: Joi.string().max(100).allow(null, "").optional(),
  notes: Joi.string().max(5000).allow(null, "").optional(),
});

const updateAppointmentSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).optional(),
  type: Joi.string().valid("TEST_DRIVE","VIEWING","HANDOVER","MEETING","OTHER").optional(),
  status: Joi.string().valid("SCHEDULED","COMPLETED","CANCELLED").optional(),
  startAt: Joi.date().iso().optional(),
  endAt: Joi.date().iso().optional(),
  clientName: Joi.string().trim().max(150).allow(null, "").optional(),
  clientPhone: Joi.string().trim().max(30).allow(null, "").optional(),
  listingId: Joi.string().max(100).allow(null, "").optional(),
  notes: Joi.string().max(5000).allow(null, "").optional(),
});

const updateNetworkSettingsSchema = Joi.object({
  networkEnabled: Joi.boolean().optional(),
  city: Joi.string().max(200).allow(null, "").optional(),
  networkDisplayName: Joi.string().max(200).allow(null, "").optional(),
  networkContactPhone: Joi.string().max(200).allow(null, "").optional(),
  networkContactEmail: Joi.string().max(200).allow(null, "").optional(),
});

const createTransportRunSchema = Joi.object({
  fromCity: Joi.string().trim().min(2).max(100).required(),
  toCity: Joi.string().trim().min(2).max(100).required(),
  departureDate: Joi.date().iso().required(),
  seatsTotal: Joi.number().integer().min(1).max(100).required(),
  pricePerCar: Joi.number().min(0).allow(null).optional(),
  notes: Joi.string().max(2000).allow(null, "").optional(),
  kind: Joi.string().valid('OFFER','REQUEST').default('OFFER'),
  transportType: Joi.string().valid('PLATFORM_OPEN','ENCLOSED','TARP').allow(null).optional(),
  acceptsNonRunning: Joi.boolean().default(false),
  fromCountry: Joi.string().length(2).uppercase().allow(null,'').optional(),
  departureDateEnd: Joi.date().iso().min(Joi.ref('departureDate')).allow(null).optional()
});

const expressInterestSchema = Joi.object({
  seatsRequested: Joi.number().integer().min(1).max(100).default(1),
  note: Joi.string().max(1000).allow(null, "").optional(),
});

const updateTransportRunSchema = Joi.object({
  status: Joi.string().valid("OPEN", "CLOSED").optional(),
  seatsAvailable: Joi.number().integer().min(0).optional(),
  notes: Joi.string().max(2000).allow(null, "").optional(),
  pricePerCar: Joi.number().min(0).allow(null).optional(),
  transportType: Joi.string().valid('PLATFORM_OPEN','ENCLOSED','TARP').allow(null).optional(),
  acceptsNonRunning: Joi.boolean().optional(),
  fromCountry: Joi.string().length(2).uppercase().allow(null,'').optional(),
  departureDateEnd: Joi.date().iso().allow(null).optional(),
});

const getOrCreateConversationSchema = Joi.object({
  otherBusinessId: Joi.string().required(),
  contextType: Joi.string().valid('GENERAL','TRANSPORT','TRADE').optional(),
  contextId: Joi.string().allow(null, '').optional(),
});

const sendMessageSchema = Joi.object({
  body: Joi.string().trim().min(1).max(4000).required(),
});

const exposeTradeSchema = Joi.object({
  listingId: Joi.string().required(),
  b2bPrice: Joi.number().min(0).allow(null).optional(),
  acceptsTrade: Joi.boolean().default(false),
  note: Joi.string().max(2000).allow(null, '').optional(),
});

const updateTradeSchema = Joi.object({
  b2bPrice: Joi.number().min(0).allow(null).optional(),
  acceptsTrade: Joi.boolean().optional(),
  note: Joi.string().max(2000).allow(null, '').optional(),
  status: Joi.string().valid('ACTIVE', 'CLOSED').optional(),
});

const createProposalSchema = Joi.object({
  tradeListingId: Joi.string().required(),
  kind: Joi.string().valid('BUY', 'EXCHANGE').required(),
  offeredPrice: Joi.number().min(0).allow(null).optional(),
  offeredListingId: Joi.string().allow(null, '').optional(),
  note: Joi.string().max(2000).allow(null, '').optional(),
});

const counterProposalSchema = Joi.object({
  kind: Joi.string().valid('BUY', 'EXCHANGE').required(),
  offeredPrice: Joi.number().min(0).allow(null).optional(),
  offeredListingId: Joi.string().allow(null, '').optional(),
  note: Joi.string().max(2000).allow(null, '').optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  categorySchema,
  attributeSchema,
  createListingSchema,
  updateListingSchema,
  markAsSoldSchema,
  contactFormSchema,
  createManualLeadSchema,
  reviewSchema,
  updateProfileSchema,
  updateSettingsSchema,
  updateIdentitySchema,
  attributeGroupSchema,
  assignAttributesSchema,
  createOfferSchema,
  createContractSchema,
  handoverSchema,
  createReservationSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateNetworkSettingsSchema,
  createTransportRunSchema,
  expressInterestSchema,
  updateTransportRunSchema,
  getOrCreateConversationSchema,
  sendMessageSchema,
  exposeTradeSchema,
  updateTradeSchema,
  createProposalSchema,
  counterProposalSchema,
};