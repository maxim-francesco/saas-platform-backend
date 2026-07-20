const sharp = require("sharp");
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const axios = require("axios");
const stream = require("stream");
const fs = require("fs");
const bestAutoService = require("../services/bestAutoService");
const autovitService = require("../services/autovitService");
const { uploadToYouTube } = require('../services/youtubeService');
const { google } = require('googleapis');

const uploadVideo = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { businessId } = req.user;
    if (!req.file) {
      return res.status(400).json({ message: 'Niciun fișier video primit.' });
    }
    const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId } });
    if (!listing) {
      if (req.file.path) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Anunțul nu a fost găsit sau nu aveți acces.' });
    }
    
    const fileSizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);
    console.log(`[Video Upload] Începe încărcarea pentru anunțul ${listingId} (${fileSizeInMB} MB)`);

    cloudinary.uploader.upload_large(
      req.file.path,
      { 
        resource_type: "video", 
        folder: "listings_videos", 
        public_id: `video_${listingId}`, 
        overwrite: true,
        chunk_size: 6000000 // 6MB per chunk for large files
      },
      async (error, result) => {
        // Ștergem fișierul temporar de pe disc
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        if (error) {
          console.error('Cloudinary Error:', error);
          return res.status(500).json({ message: 'Eroare la încărcarea în Cloudinary.' });
        }
        await prisma.listing.update({ where: { id: listingId }, data: { youtubeVideoId: result.secure_url } });
        return res.status(200).json({ message: 'Video salvat pe Cloudinary!', videoUrl: result.secure_url });
      }
    );
  } catch (error) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    console.error('Upload Video Error:', error);
    res.status(500).json({ message: 'Eroare server la procesarea video.' });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const { listingId } = req.params;
    const { businessId } = req.user;
    const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId }, select: { youtubeVideoId: true } });
    if (!listing || !listing.youtubeVideoId) {
      return res.status(404).json({ message: 'Nu există video de șters.' });
    }
    if (listing.youtubeVideoId.includes('cloudinary.com')) {
      const publicId = `listings_videos/video_${listingId}`;
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
      } catch (cloudErr) {
        console.error('Eroare la ștergerea din Cloudinary:', cloudErr);
      }
    }
    await prisma.listing.update({ where: { id: listingId }, data: { youtubeVideoId: null } });
    res.status(200).json({ message: 'Video șters cu succes din Cloudinary și DB.' });
  } catch (error) {
    console.error('Delete Video Error:', error);
    res.status(500).json({ message: 'Eroare la ștergerea videoclipului.' });
  }
};

const generateSlug = (text) => {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

const uploadImages = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  const rotation = parseInt(req.body.rotation || "0", 10);
  const STANDARD_WIDTH = 1600;
  try {
    if (!req.file) return res.status(400).json({ message: "Niciun fișier încărcat." });
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId } });
    if (!listing) return res.status(404).json({ message: "Anunț negăsit." });
    let processedImagePipeline = sharp(req.file.buffer).rotate().rotate(rotation).resize({ width: STANDARD_WIDTH, withoutEnlargement: false });
    let imageBuffer = await processedImagePipeline.toBuffer();
    const metadata = await sharp(imageBuffer).metadata();
    if (business.bannerUrl) {
      const BANNER_HEIGHT = 150;
      try {
        const bannerResponse = await axios({ url: business.bannerUrl, responseType: "arraybuffer" });
        const bannerInputBuffer = Buffer.from(bannerResponse.data, "binary");
        const bannerResizedBuffer = await sharp(bannerInputBuffer).resize({ width: metadata.width, height: BANNER_HEIGHT, fit: "fill" }).toBuffer();
        imageBuffer = await sharp(imageBuffer).extend({ bottom: BANNER_HEIGHT, background: { r: 255, g: 255, b: 255, alpha: 1 } }).composite([{ input: bannerResizedBuffer, gravity: "south" }]).jpeg({ quality: 90 }).toBuffer();
      } catch (err) {
        console.error("Eroare la aplicarea bannerului:", err);
        imageBuffer = await processedImagePipeline.jpeg({ quality: 90 }).toBuffer();
      }
    } else {
      imageBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
    }
    const folderPath = `saas-platform/${businessId}/${listing.id}`;
    const uploadStream = cloudinary.uploader.upload_stream({ resource_type: "image", folder: folderPath }, async (error, result) => {
      if (error) return res.status(500).json({ message: "Eroare la upload Cloudinary." });

      const image = await prisma.$transaction(async (tx) => {
        const imageCount = await tx.listingImage.count({ where: { listingId: listingId } });
        return await tx.listingImage.create({ data: { url: result.secure_url, listingId: listingId, order: imageCount } });
      });

      res.status(201).json(image);

      // --- INTEGRATION BESTAUTO: SYNC DUPĂ UPLOAD IMAGINE ---
      ;(async () => {
        try {
          const fullListing = await prisma.listing.findUnique({
            where: { id: listingId },
            include: {
              business: true,
              attributeValues: { include: { attribute: true } },
              images: { orderBy: { order: "asc" } },
            },
          });
          if (fullListing?.business?.bestAutoApiKey) {
            await bestAutoService.publishListing(fullListing, fullListing.business.bestAutoApiKey);
          }
        } catch (err) {
          console.error("[BestAuto] Eroare la sincronizare (uploadImages):", err.message);
        }
      })();
      // --- END BESTAUTO: SYNC DUPĂ UPLOAD IMAGINE ---

      // --- END BESTAUTO: SYNC DUPĂ UPLOAD IMAGINE ---

      // --- INTEGRATION AUTOVIT: SYNC DUPĂ UPLOAD IMAGINE ---
//       ;(async () => {
//   try {
//     const fullListing = await prisma.listing.findUnique({
//       where: { id: listingId },
//       include: {
//         business: true,
//         attributeValues: { include: { attribute: true } },
//         images: { orderBy: { order: "asc" } },
//       },
//     });

//     const b = fullListing?.business;
//     if (!b?.autovitClientId || !b?.autovitUsername) return;

//     const imageUrls = fullListing.images.map(img => img.url);
//     if (imageUrls.length === 0) return;

//     const token = await autovitService.getAccessToken(
//       b.autovitClientId, b.autovitClientSecret,
//       b.autovitUsername, b.autovitPassword
//     );

//     const imageCollectionId = await autovitService.createImageCollection(
//       imageUrls, token, b.autovitUsername
//     );

//     const payload = autovitService.mapListingToAutovit(fullListing, imageCollectionId);

//     if (fullListing.autovitId) {
//       // Anunțul există deja pe Autovit — actualizăm
//       await autovitService.updateAdvert(fullListing.autovitId, payload, token, b.autovitUsername);
//       console.log(`[Autovit] Anunț ${fullListing.autovitId} actualizat cu imagini noi.`);
//     } else {
//       // Prima imagine uploadată — creăm anunțul
//       // verificare race condition
// const freshListing = await prisma.listing.findUnique({
//   where: { id: listingId },
//   select: { autovitId: true },
// });

// if (freshListing?.autovitId) {
//   await autovitService.updateAdvert(freshListing.autovitId, payload, token, b.autovitUsername);
//   console.log(`[Autovit] Anunț ${freshListing.autovitId} actualizat (race condition evitat).`);
//   return;
// }

// // Prima imagine uploadată — creăm anunțul
// const result = await autovitService.createAdvert(payload, token, b.autovitUsername);
      
//       // Salvăm ID-ul în DB
//       await prisma.listing.update({
//         where: { id: listingId },
//         data: { autovitId: BigInt(result.id), autovitStatus: "inactive" },
//       });
//       console.log(`[Autovit] Anunț creat cu ID: ${result.id}`);

//       // ─── ACTIVARE AUTOMATĂ ───
// try {
//   await autovitService.activateAdvert(result.id, token, b.autovitUsername);
//   await prisma.listing.update({
//     where: { id: listingId },
//     data: { autovitStatus: "active" },
//   });
//   console.log(`[Autovit] Anunț ${result.id} activat automat.`);

//   // ─── EXPORT OLX AUTOMAT ───
//   try {
//     await autovitService.exportToOLX(result.id, token, b.autovitUsername);
//     console.log(`[Autovit] Anunț ${result.id} exportat pe OLX automat.`);
//   } catch (olxErr) {
//     console.error(`[Autovit] Eroare export OLX automat:`, olxErr.message);
//   }
//   // ─── SFÂRȘIT EXPORT OLX ───

// } catch (activateErr) {
//   console.error(`[Autovit] Eroare la activare automată:`, activateErr.message);
// }
// // ─── SFÂRȘIT ACTIVARE ───
//       // ─── SFÂRȘIT ACTIVARE ───
//     }
//   } catch (err) {
//     console.error("[Autovit] Eroare la sincronizare (uploadImages):", err.message);
//   }
// })();
      // --- END AUTOVIT: SYNC DUPĂ UPLOAD IMAGINE ---


    });
    uploadStream.end(imageBuffer);
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ message: "Eroare internă la procesarea imaginii." });
  }
};

const createListing = async (req, res) => {
  const {
    title, description, internalNotes,
    makeId, modelId, variant, year, mileage, vin, firstRegistrationAt, countryOfOrigin, registeredInRo,
    fuelType, gearbox, drivetrain, bodyType, engineCapacity, powerHp, pollutionNorm, co2Emissions,
    color, colorDetail, upholstery, airConditioning, doors, seats,
    vatDeductible, noAccidents, serviceBook, firstOwner, ownerCount, warrantyMonths,
    price, purchasePrice, sellingPrice, otherCosts, status, youtubeVideoId,
    featureIds = [], extraSpecs
  } = req.body;
  const { businessId } = req.user;

  try {
    const slug = generateSlug(title);
    const newListing = await prisma.listing.create({
      data: {
        businessId,
        title,
        slug,
        description,
        internalNotes,
        makeId: makeId || null,
        modelId: modelId || null,
        variant: variant || null,
        year: year != null ? parseInt(year, 10) : null,
        mileage: mileage != null ? parseInt(mileage, 10) : null,
        vin: vin || null,
        firstRegistrationAt: firstRegistrationAt ? new Date(firstRegistrationAt) : null,
        countryOfOrigin: countryOfOrigin || null,
        registeredInRo: registeredInRo != null ? Boolean(registeredInRo) : null,
        fuelType: fuelType || null,
        gearbox: gearbox || null,
        drivetrain: drivetrain || null,
        bodyType: bodyType || null,
        engineCapacity: engineCapacity != null ? parseInt(engineCapacity, 10) : null,
        powerHp: powerHp != null ? parseInt(powerHp, 10) : null,
        pollutionNorm: pollutionNorm || null,
        co2Emissions: co2Emissions != null ? parseInt(co2Emissions, 10) : null,
        color: color || null,
        colorDetail: colorDetail || null,
        upholstery: upholstery || null,
        airConditioning: airConditioning || null,
        doors: doors != null ? parseInt(doors, 10) : null,
        seats: seats != null ? parseInt(seats, 10) : null,
        vatDeductible: vatDeductible != null ? Boolean(vatDeductible) : null,
        noAccidents: noAccidents != null ? Boolean(noAccidents) : null,
        serviceBook: serviceBook != null ? Boolean(serviceBook) : null,
        firstOwner: firstOwner != null ? Boolean(firstOwner) : null,
        ownerCount: ownerCount != null ? parseInt(ownerCount, 10) : null,
        warrantyMonths: warrantyMonths != null ? parseInt(warrantyMonths, 10) : null,
        price: price != null ? parseFloat(price) : null,
        purchasePrice: purchasePrice != null ? parseFloat(purchasePrice) : null,
        sellingPrice: sellingPrice != null ? parseFloat(sellingPrice) : null,
        otherCosts: otherCosts != null ? parseFloat(otherCosts) : null,
        status: status || "AVAILABLE",
        youtubeVideoId: youtubeVideoId || null,
        extraSpecs: extraSpecs || null,
        features: {
          connect: (featureIds || []).map(id => ({ id }))
        }
      },
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      }
    });

    // --- INTEGRATION BESTAUTO: CREATE ---
    // TODO(bestauto-v2): BestAuto integration needs to be refactored for fixed schema v2.
    // Guarded to prevent EAV relation crash.
    const enableBestAutoSync = false;
    if (enableBestAutoSync) {
      ;(async () => {
        try {
          if (newListing?.business?.bestAutoApiKey) {
            await bestAutoService.publishListing(newListing, newListing.business.bestAutoApiKey);
          }
        } catch (err) {
          console.error("[BestAuto] Eroare la sincronizare (create):", err.message);
        }
      })();
    }
    // --- END BESTAUTO: CREATE ---

    const { toLegacyListing } = require("../utils/compatSerializer");
    res.status(201).json(toLegacyListing(newListing, { mode: 'byId' }));
  } catch (error) {
    console.error("Eroare la crearea anunțului:", error);
    res.status(400).json({ message: error.message || "Eroare la crearea anunțului." });
  }
};

const getListings = async (req, res) => {
  const { businessId } = req.user;
  try {
    const { releaseExpiredReservations } = require("./reservationController");
    await releaseExpiredReservations(businessId);

    const listings = await prisma.listing.findMany({
      where: { businessId, status: { in: ["AVAILABLE", "RESERVED"] } },
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } },
        _count: { select: { views: true } },
      },
    });
    const { toLegacyListing } = require("../utils/compatSerializer");
    const legacyListings = listings.map(l => {
      const legacy = toLegacyListing(l, { mode: 'search' });
      legacy._count = l._count;
      return legacy;
    });
    res.status(200).json(legacyListings);
  } catch (error) {
    console.error("Error in getListings:", error);
    res.status(500).json({ message: "Eroare la preluarea anunțurilor." });
  }
};

const getSoldListings = async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: "Business ID is required." });
  try {
    const listings = await prisma.listing.findMany({
      where: { businessId, status: "SOLD" },
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      },
      orderBy: { soldAt: "desc" },
      take: req.query.limit ? parseInt(req.query.limit) : undefined,
    });
    const { toLegacyListing } = require("../utils/compatSerializer");
    const legacyListings = listings.map(l => toLegacyListing(l, { mode: 'search' }));
    res.status(200).json(legacyListings);
  } catch (error) {
    console.error("Error in getSoldListings:", error);
    res.status(500).json({ message: "Eroare la preluarea anunțurilor vândute." });
  }
};

const markAsSold = async (req, res) => {
  const { listingId } = req.params;
  const { sellingPrice, soldAt } = req.body;
  const { businessId } = req.user;
  if (!sellingPrice || !soldAt) return res.status(400).json({ message: "Prețul de vânzare și data sunt obligatorii." });
  try {
    const result = await prisma.listing.updateMany({ where: { id: listingId, businessId }, data: { status: "SOLD", sellingPrice: parseFloat(sellingPrice), soldAt: new Date(soldAt) } });
    if (result.count === 0) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit sau nu aveți acces." });
    }
    res.status(200).json({ message: "Anunțul a fost marcat ca vândut." });  
  } catch (error) {
    res.status(500).json({ message: "Eroare la marcarea anunțului ca vândut." });
  }
};

const updateListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  const {
    title, description, internalNotes,
    makeId, modelId, variant, year, mileage, vin, firstRegistrationAt, countryOfOrigin, registeredInRo,
    fuelType, gearbox, drivetrain, bodyType, engineCapacity, powerHp, pollutionNorm, co2Emissions,
    color, colorDetail, upholstery, airConditioning, doors, seats,
    vatDeductible, noAccidents, serviceBook, firstOwner, ownerCount, warrantyMonths,
    price, purchasePrice, sellingPrice, otherCosts, status, youtubeVideoId,
    featureIds, extraSpecs
  } = req.body;

  try {
    const originalListing = await prisma.listing.findFirst({
      where: { id: listingId, businessId }
    });
    if (!originalListing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit sau nu aveți acces la el." });
    }

    const updateData = {};
    if (title !== undefined) {
      updateData.title = title;
      updateData.slug = generateSlug(title);
    }
    if (description !== undefined) updateData.description = description || null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null;
    if (makeId !== undefined) updateData.makeId = makeId || null;
    if (modelId !== undefined) updateData.modelId = modelId || null;
    if (variant !== undefined) updateData.variant = variant || null;
    if (year !== undefined) updateData.year = year != null ? parseInt(year, 10) : null;
    if (mileage !== undefined) updateData.mileage = mileage != null ? parseInt(mileage, 10) : null;
    if (vin !== undefined) updateData.vin = vin || null;
    if (firstRegistrationAt !== undefined) updateData.firstRegistrationAt = firstRegistrationAt ? new Date(firstRegistrationAt) : null;
    if (countryOfOrigin !== undefined) updateData.countryOfOrigin = countryOfOrigin || null;
    if (registeredInRo !== undefined) updateData.registeredInRo = registeredInRo != null ? Boolean(registeredInRo) : null;
    
    if (fuelType !== undefined) updateData.fuelType = fuelType || null;
    if (gearbox !== undefined) updateData.gearbox = gearbox || null;
    if (drivetrain !== undefined) updateData.drivetrain = drivetrain || null;
    if (bodyType !== undefined) updateData.bodyType = bodyType || null;
    if (engineCapacity !== undefined) updateData.engineCapacity = engineCapacity != null ? parseInt(engineCapacity, 10) : null;
    if (powerHp !== undefined) updateData.powerHp = powerHp != null ? parseInt(powerHp, 10) : null;
    if (pollutionNorm !== undefined) updateData.pollutionNorm = pollutionNorm || null;
    if (co2Emissions !== undefined) updateData.co2Emissions = co2Emissions != null ? parseInt(co2Emissions, 10) : null;
    
    if (color !== undefined) updateData.color = color || null;
    if (colorDetail !== undefined) updateData.colorDetail = colorDetail || null;
    if (upholstery !== undefined) updateData.upholstery = upholstery || null;
    if (airConditioning !== undefined) updateData.airConditioning = airConditioning || null;
    if (doors !== undefined) updateData.doors = doors != null ? parseInt(doors, 10) : null;
    if (seats !== undefined) updateData.seats = seats != null ? parseInt(seats, 10) : null;
    
    if (vatDeductible !== undefined) updateData.vatDeductible = vatDeductible != null ? Boolean(vatDeductible) : null;
    if (noAccidents !== undefined) updateData.noAccidents = noAccidents != null ? Boolean(noAccidents) : null;
    if (serviceBook !== undefined) updateData.serviceBook = serviceBook != null ? Boolean(serviceBook) : null;
    if (firstOwner !== undefined) updateData.firstOwner = firstOwner != null ? Boolean(firstOwner) : null;
    if (ownerCount !== undefined) updateData.ownerCount = ownerCount != null ? parseInt(ownerCount, 10) : null;
    if (warrantyMonths !== undefined) updateData.warrantyMonths = warrantyMonths != null ? parseInt(warrantyMonths, 10) : null;
    
    if (price !== undefined) updateData.price = price != null ? parseFloat(price) : null;
    if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice != null ? parseFloat(purchasePrice) : null;
    if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice != null ? parseFloat(sellingPrice) : null;
    if (otherCosts !== undefined) updateData.otherCosts = otherCosts != null ? parseFloat(otherCosts) : null;
    if (status !== undefined) updateData.status = status;
    if (youtubeVideoId !== undefined) updateData.youtubeVideoId = youtubeVideoId || null;
    if (extraSpecs !== undefined) updateData.extraSpecs = extraSpecs || null;

    if (featureIds !== undefined) {
      updateData.features = {
        set: (featureIds || []).map(id => ({ id }))
      };
    }

    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: updateData,
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      }
    });

    // --- INTEGRATION BESTAUTO: UPDATE ---
    // TODO(bestauto-v2): BestAuto integration needs to be refactored for fixed schema v2.
    // Guarded to prevent EAV relation crash.
    const enableBestAutoSync = false;
    if (enableBestAutoSync) {
      ;(async () => {
        try {
          // ...
        } catch (err) {
          console.error("[BestAuto] Eroare la sincronizare (update):", err.message);
        }
      })();
    }

    // --- INTEGRATION AUTOVIT: UPDATE ---
    // TODO(autovit-v2): Autovit integration needs to be refactored for fixed schema v2.
    // Guarded to prevent EAV relation crash.
    const enableAutovitSync = false;
    if (enableAutovitSync) {
      ;(async () => {
        try {
          const fullListing = await prisma.listing.findUnique({
            where: { id: listingId },
            include: {
              business: true,
              images: { orderBy: { order: "asc" } },
            },
          });

          const b = fullListing?.business;
          if (b?.autovitClientId && b?.autovitUsername && fullListing.autovitId) {
            const imageUrls = fullListing.images.map(img => img.url);
            if (imageUrls.length === 0) return;

            const token = await autovitService.getAccessToken(
              b.autovitClientId, b.autovitClientSecret,
              b.autovitUsername, b.autovitPassword
            );

            const imageCollectionId = await autovitService.createImageCollection(
              imageUrls, token, b.autovitUsername
            );

            const payload = autovitService.mapListingToAutovit(fullListing, imageCollectionId);
            await autovitService.updateAdvert(fullListing.autovitId, payload, token, b.autovitUsername);
          }
        } catch (err) {
          console.error("[Autovit] Eroare la sincronizare (update):", err.message);
        }
      })();
    }
    // --- END AUTOVIT: UPDATE ---

    const { toLegacyListing } = require("../utils/compatSerializer");
    res.status(200).json(toLegacyListing(updatedListing, { mode: 'byId' }));
  } catch (error) {
    console.error("Eroare la update listing:", error);
    res.status(500).json({ message: error.message || "Eroare la actualizarea anunțului." });
  }
};

const deleteListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  let bestAutoApiKey = null;
  let autovitClientId = null, autovitClientSecret = null;
  let autovitUsername = null, autovitPassword = null;
  let autovitId = null;

  try {
    const businessData = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        bestAutoApiKey: true,
        autovitClientId: true,
        autovitClientSecret: true,
        autovitUsername: true,
        autovitPassword: true,
      },
    });
    bestAutoApiKey = businessData?.bestAutoApiKey;
    autovitClientId = businessData?.autovitClientId;
    autovitClientSecret = businessData?.autovitClientSecret;
    autovitUsername = businessData?.autovitUsername;
    autovitPassword = businessData?.autovitPassword;

    const listingData = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { autovitId: true },
    });
    autovitId = listingData?.autovitId;
  } catch (e) {
    console.error("Eroare la preluare date pentru delete:", e);
  }

  try {
    const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId } });
    if (!listing) {
      return res.status(404).json({ message: "Anunțul nu a fost găsit sau nu aveți acces la el." });
    }

    await prisma.listing.delete({ where: { id: listingId } });

    // --- INTEGRATION BESTAUTO: DELETE ---
    if (bestAutoApiKey) {
      bestAutoService.deleteListing(listingId, bestAutoApiKey)
        .catch((err) => console.error("[BestAuto] Eroare la ștergere:", err.message));
    }
    // --- END BESTAUTO: DELETE ---

    // --- INTEGRATION AUTOVIT: DELETE ---
    ;(async () => {
      try {
        if (autovitId && autovitClientId) {
          const token = await autovitService.getAccessToken(
            autovitClientId, autovitClientSecret,
            autovitUsername, autovitPassword
          );

          // Mai întâi dezactivăm, apoi ștergem
          try {
            await autovitService.deactivateAdvert(autovitId, token, autovitUsername);
            console.log(`[Autovit] Anunț ${autovitId} dezactivat înainte de ștergere.`);
          } catch (deactivateErr) {
            console.warn(`[Autovit] Nu s-a putut dezactiva (poate era deja inactiv):`, deactivateErr.message);
            // Continuăm oricum cu ștergerea
          }

          // Mică pauză să proceseze Autovit dezactivarea
          await new Promise(resolve => setTimeout(resolve, 1000));

          await autovitService.deleteAdvert(autovitId, token, autovitUsername);
          console.log(`[Autovit] Anunț ${autovitId} șters cu succes.`);
        }
      } catch (err) {
        console.error("[Autovit] Eroare la ștergere:", err.message);
      }
    })();
    // --- END AUTOVIT: DELETE ---

    res.status(200).json({ message: "Anunțul a fost șters." });
  } catch (error) {
    res.status(500).json({ message: error.message || "Eroare la ștergerea anunțului." });
  }
};

const getListingById = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId: businessId },
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      },
    });
    if (!listing) return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    
    const { toLegacyListing } = require("../utils/compatSerializer");
    res.status(200).json(toLegacyListing(listing, { mode: 'byId' }));
  } catch (error) {
    console.error("Error in getListingById:", error);
    res.status(500).json({ message: "Eroare la preluarea anunțului." });
  }
};

const deleteImage = async (req, res) => {
  const { listingId, imageId } = req.params;
  const { businessId } = req.user;
  try {
    const imageToDelete = await prisma.listingImage.findFirst({ where: { id: imageId, listingId: listingId, listing: { businessId: businessId } } });
    if (!imageToDelete) return res.status(404).json({ message: "Imaginea nu a fost găsită sau nu aveți acces." });
    const publicIdMatch = imageToDelete.url.match(/upload\/(?:v\d+\/)?(.+?)\./);
    if (publicIdMatch && publicIdMatch[1]) {
      await cloudinary.uploader.destroy(publicIdMatch[1]);
    } else {
      console.error("Nu s-a putut extrage ID-ul public din URL:", imageToDelete.url);
    }
    await prisma.listingImage.delete({ where: { id: imageId } });
    res.status(200).json({ message: "Imaginea a fost ștearsă cu succes (DB & Cloudinary)." });
  } catch (error) {
    console.error("Eroare la ștergerea imaginii:", error);
    res.status(500).json({ message: "Eroare internă la ștergerea imaginii." });
  }
};

const updateImageOrder = async (req, res) => {
  console.log(`[SPION] S-a primit o cerere de re-ordonare pentru anunțul ${req.params.listingId}`);
  const { listingId } = req.params;
  const { imageIds } = req.body;
  const { businessId } = req.user;
  if (!Array.isArray(imageIds)) {
    return res.status(400).json({ message: "Este necesar un array de ID-uri." });
  }
  try {
    const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId } });
    if (!listing) {
      return res.status(404).json({ message: "Anunț negăsit." });
    }
    const updatePromises = imageIds.map((imageId, index) => {
      return prisma.listingImage.update({ where: { id: imageId }, data: { order: index } });
    });
    await prisma.$transaction(updatePromises);
    res.status(200).json({ message: "Ordinea imaginilor a fost actualizată." });
  } catch (error) {
    console.error("[DEBUG] EROARE MAJORĂ în updateImageOrder:", error);
    res.status(500).json({ message: "Eroare la actualizarea ordinii imaginilor." });
  }
};

const cloneListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  try {
    const originalListing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
      include: { features: true }
    });
    if (!originalListing) {
      return res.status(404).json({ message: "Anunțul original nu a fost găsit sau nu aveți acces." });
    }

    const clonedTitle = `${originalListing.title} (Copie)`;
    const clonedSlug = generateSlug(clonedTitle);

    const newListing = await prisma.listing.create({
      data: {
        businessId: originalListing.businessId,
        title: clonedTitle,
        slug: clonedSlug,
        description: originalListing.description,
        internalNotes: originalListing.internalNotes,
        makeId: originalListing.makeId,
        modelId: originalListing.modelId,
        variant: originalListing.variant,
        year: originalListing.year,
        mileage: originalListing.mileage,
        vin: originalListing.vin,
        firstRegistrationAt: originalListing.firstRegistrationAt,
        countryOfOrigin: originalListing.countryOfOrigin,
        registeredInRo: originalListing.registeredInRo,
        fuelType: originalListing.fuelType,
        gearbox: originalListing.gearbox,
        drivetrain: originalListing.drivetrain,
        bodyType: originalListing.bodyType,
        engineCapacity: originalListing.engineCapacity,
        powerHp: originalListing.powerHp,
        pollutionNorm: originalListing.pollutionNorm,
        co2Emissions: originalListing.co2Emissions,
        color: originalListing.color,
        colorDetail: originalListing.colorDetail,
        upholstery: originalListing.upholstery,
        airConditioning: originalListing.airConditioning,
        doors: originalListing.doors,
        seats: originalListing.seats,
        vatDeductible: originalListing.vatDeductible,
        noAccidents: originalListing.noAccidents,
        serviceBook: originalListing.serviceBook,
        firstOwner: originalListing.firstOwner,
        ownerCount: originalListing.ownerCount,
        warrantyMonths: originalListing.warrantyMonths,
        price: originalListing.price,
        purchasePrice: originalListing.purchasePrice,
        sellingPrice: null,
        otherCosts: originalListing.otherCosts,
        status: "AVAILABLE",
        soldAt: null,
        youtubeVideoId: originalListing.youtubeVideoId,
        extraSpecs: originalListing.extraSpecs || null,
        features: {
          connect: (originalListing.features || []).map(f => ({ id: f.id }))
        }
      },
      include: {
        make: true,
        model: true,
        features: true,
        images: { orderBy: { order: "asc" } }
      }
    });

    const { toLegacyListing } = require("../utils/compatSerializer");
    res.status(201).json(toLegacyListing(newListing, { mode: 'byId' }));
  } catch (error) {
    console.error("Eroare la clonarea anunțului:", error);
    res.status(500).json({ message: error.message || "Eroare la clonarea anunțului." });
  }
};

const reactivateListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  try {
    const result = await prisma.listing.updateMany({ where: { id: listingId, businessId }, data: { status: "AVAILABLE", soldAt: null, sellingPrice: null } });
    if (result.count === 0) return res.status(404).json({ message: "Anunțul vândut nu a fost găsit." });
    res.status(200).json({ message: "Anunțul a fost reactivat și mutat înapoi la vânzare." });
  } catch (error) {
    res.status(500).json({ message: "Eroare la reactivarea anunțului." });
  }
};

module.exports = {
  createListing,
  getListings,
  updateListing,
  deleteListing,
  getListingById,
  deleteImage,
  uploadImages,
  updateImageOrder,
  getSoldListings,
  markAsSold,
  reactivateListing,
  cloneListing,
  uploadVideo,
  deleteVideo,
};