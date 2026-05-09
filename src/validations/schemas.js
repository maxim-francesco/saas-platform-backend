// src/validations/schemas.js
const Joi = require("joi");

// --- AUTH ---
const registerSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(6).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
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
const createListingSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().max(5000).allow(null, "").optional(),
  internalNotes: Joi.string().max(5000).allow(null, "").optional(),
  categoryId: Joi.string().required(),
  purchasePrice: Joi.number().min(0).allow(null).optional(),
  otherCosts: Joi.number().min(0).allow(null).optional(),
  attributes: Joi.array().items(
    Joi.object({
      attributeId: Joi.string().required(),
      value: Joi.alternatives().try(
        Joi.string().max(500),
        Joi.number(),
        Joi.boolean()
      ).required(),
    })
  ).optional(),
});

const updateListingSchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).optional(),
  description: Joi.string().max(5000).allow(null, "").optional(),
  internalNotes: Joi.string().max(5000).allow(null, "").optional(),
  purchasePrice: Joi.number().min(0).allow(null).optional(),
  otherCosts: Joi.number().min(0).allow(null).optional(),
  attributes: Joi.array().items(
    Joi.object({
      attributeId: Joi.string().required(),
      value: Joi.alternatives().try(
        Joi.string().max(500),
        Joi.number(),
        Joi.boolean()
      ).required(),
    })
  ).optional(),
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

// --- ATTRIBUTE GROUPS ---
const attributeGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
});

const assignAttributesSchema = Joi.object({
  attributeIds: Joi.array().items(Joi.string()).min(1).required(),
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
  reviewSchema,
  updateProfileSchema,
  updateSettingsSchema,
  attributeGroupSchema,
  assignAttributesSchema,
};