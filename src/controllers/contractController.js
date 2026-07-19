const prisma = require("../config/prismaClient");
const crypto = require("crypto");
const { generateSlug, generateCode } = require("../utils/slugify");

const createContract = async (req, res) => {
  try {
    const { businessId } = req.user;
    const {
      listingId,
      buyerType,
      buyerName,
      buyerAddress,
      buyerPhone,
      buyerEmail,
      buyerCnp,
      buyerCiSeries,
      buyerCiNumber,
      buyerCui,
      buyerRegCom,
      buyerLegalRep,
      salePrice,
      saleDate,
      plateNumber,
      mileageAtSale,
      clauses
    } = req.body;

    // SECURITY: verify the listing belongs to this business
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: { make: true, model: true }
    });

    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu există sau nu aparține acestui business." });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return res.status(404).json({ message: "Business-ul nu a fost găsit." });
    }

    // UPSERT buyer: find by businessId + cnp/cui if provided
    let buyer;
    let existingBuyer = null;

    if (buyerType === "INDIVIDUAL" && buyerCnp) {
      existingBuyer = await prisma.buyer.findFirst({
        where: { businessId, cnp: buyerCnp }
      });
    } else if (buyerType === "COMPANY" && buyerCui) {
      existingBuyer = await prisma.buyer.findFirst({
        where: { businessId, cui: buyerCui }
      });
    }

    const buyerData = {
      type: buyerType,
      name: buyerName,
      address: buyerAddress || null,
      phone: buyerPhone || null,
      email: buyerEmail || null,
      cnp: buyerCnp || null,
      ciSeries: buyerCiSeries || null,
      ciNumber: buyerCiNumber || null,
      cui: buyerCui || null,
      regCom: buyerRegCom || null,
      legalRep: buyerLegalRep || null
    };

    if (existingBuyer) {
      buyer = await prisma.buyer.update({
        where: { id: existingBuyer.id },
        data: buyerData
      });
    } else {
      buyer = await prisma.buyer.create({
        data: {
          businessId,
          ...buyerData
        }
      });
    }

    // contractNumber: compute next per business
    const last = await prisma.contract.findFirst({
      where: { businessId },
      orderBy: { contractNumber: 'desc' },
      select: { contractNumber: true }
    });
    const contractNumber = (last?.contractNumber || 0) + 1;

    // Build snapshots
    const sellerSnapshot = {
      name: business.name,
      address: business.companyAddress,
      phone: business.companyPhone,
      email: business.companyEmail,
      cui: business.companyCui,
      regCom: business.companyRegCom,
      legalRep: business.companyLegalRep
    };

    const buyerSnapshot = {
      type: buyerType,
      name: buyerName,
      address: buyerAddress,
      phone: buyerPhone,
      email: buyerEmail,
      cnp: buyerCnp,
      ciSeries: buyerCiSeries,
      ciNumber: buyerCiNumber,
      cui: buyerCui,
      regCom: buyerRegCom,
      legalRep: buyerLegalRep
    };

    const vehicleSnapshot = {
      title: listing.title,
      make: listing.make?.name || null,
      model: listing.model?.name || null,
      variant: listing.variant,
      year: listing.year,
      vin: listing.vin,
      color: listing.colorDetail || null,
      mileage: mileageAtSale ?? listing.mileage
    };

    // Tokens & codes
    const token = crypto.randomBytes(24).toString('hex');
    let code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode(8);
      const exists = await prisma.contract.findUnique({ where: { code: candidate } });
      if (!exists) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return res.status(500).json({ message: "Eroare la generarea codului contractului." });
    }

    const bizSlug = generateSlug(business.name || 'contract');

    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        businessId,
        buyerId: buyer.id,
        listingId,
        salePrice,
        saleDate: new Date(saleDate),
        vin: listing.vin || null,
        plateNumber: plateNumber || null,
        mileageAtSale: mileageAtSale ?? null,
        sellerSnapshot,
        buyerSnapshot,
        vehicleSnapshot,
        clauses: clauses || null,
        token,
        code,
        bizSlug
      }
    });

    return res.status(201).json({
      id: contract.id,
      contractNumber,
      code
    });
  } catch (error) {
    console.error("Eroare la crearea contractului:", error);
    return res.status(500).json({ message: "Eroare la crearea contractului." });
  }
};

const listContracts = async (req, res) => {
  const { businessId } = req.user;
  try {
    const contracts = await prisma.contract.findMany({
      where: { businessId },
      orderBy: { contractNumber: 'desc' },
      select: {
        id: true,
        contractNumber: true,
        salePrice: true,
        saleDate: true,
        plateNumber: true,
        handoverDate: true,
        code: true,
        createdAt: true,
        buyer: { select: { name: true, type: true } },
        vehicleSnapshot: true,
      },
    });
    res.status(200).json(contracts);
  } catch (error) {
    console.error("Eroare la preluarea contractelor:", error);
    res.status(500).json({ message: "Eroare la preluarea contractelor." });
  }
};

const getContract = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id, businessId },
      include: { buyer: true },
    });
    if (!contract) {
      return res.status(404).json({ message: "Contractul nu a fost găsit." });
    }
    res.status(200).json(contract);
  } catch (error) {
    console.error("Eroare la preluarea contractului:", error);
    res.status(500).json({ message: "Eroare la preluarea contractului." });
  }
};

const updateHandover = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  const { handoverDate, handoverMileage, handoverNotes, handoverItems } = req.body;
  try {
    // scope check first
    const existing = await prisma.contract.findFirst({ where: { id, businessId }, select: { id: true } });
    if (!existing) {
      return res.status(404).json({ message: "Contractul nu a fost găsit." });
    }
    const updated = await prisma.contract.update({
      where: { id },
      data: {
        handoverDate: handoverDate ? new Date(handoverDate) : null,
        handoverMileage: handoverMileage ?? null,
        handoverNotes: handoverNotes || null,
        handoverItems: handoverItems ?? null,
      },
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error("Eroare la actualizarea predării:", error);
    res.status(500).json({ message: "Eroare la actualizarea predării." });
  }
};

module.exports = { createContract, listContracts, getContract, updateHandover };
