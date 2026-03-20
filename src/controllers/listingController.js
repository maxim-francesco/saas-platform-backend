const sharp = require("sharp");
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const axios = require("axios");
const stream = require("stream");
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
      return res.status(404).json({ message: 'Anunțul nu a fost găsit sau nu aveți acces.' });
    }
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "video", folder: "listings_videos", public_id: `video_${listingId}`, overwrite: true },
      async (error, result) => {
        if (error) {
          console.error('Cloudinary Error:', error);
          return res.status(500).json({ message: 'Eroare la încărcarea în Cloudinary.' });
        }
        await prisma.listing.update({ where: { id: listingId }, data: { youtubeVideoId: result.secure_url } });
        return res.status(200).json({ message: 'Video salvat pe Cloudinary!', videoUrl: result.secure_url });
      }
    );
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    bufferStream.pipe(uploadStream);
  } catch (error) {
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

    const b = fullListing?.business;
    if (!b?.autovitClientId || !b?.autovitUsername) return;

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

    if (fullListing.autovitId) {
      // Anunțul există deja pe Autovit — actualizăm
      await autovitService.updateAdvert(fullListing.autovitId, payload, token, b.autovitUsername);
      console.log(`[Autovit] Anunț ${fullListing.autovitId} actualizat cu imagini noi.`);
    } else {
      // Prima imagine uploadată — creăm anunțul
      const result = await autovitService.createAdvert(payload, token, b.autovitUsername);
      
      // Salvăm ID-ul în DB
      await prisma.listing.update({
        where: { id: listingId },
        data: { autovitId: BigInt(result.id), autovitStatus: "inactive" },
      });
      console.log(`[Autovit] Anunț creat cu ID: ${result.id}`);

      // ─── ACTIVARE AUTOMATĂ ───
try {
  await autovitService.activateAdvert(result.id, token, b.autovitUsername);
  await prisma.listing.update({
    where: { id: listingId },
    data: { autovitStatus: "active" },
  });
  console.log(`[Autovit] Anunț ${result.id} activat automat.`);

  // ─── EXPORT OLX AUTOMAT ───
  try {
    await autovitService.exportToOLX(result.id, token, b.autovitUsername);
    console.log(`[Autovit] Anunț ${result.id} exportat pe OLX automat.`);
  } catch (olxErr) {
    console.error(`[Autovit] Eroare export OLX automat:`, olxErr.message);
  }
  // ─── SFÂRȘIT EXPORT OLX ───

} catch (activateErr) {
  console.error(`[Autovit] Eroare la activare automată:`, activateErr.message);
}
// ─── SFÂRȘIT ACTIVARE ───
      // ─── SFÂRȘIT ACTIVARE ───
    }
  } catch (err) {
    console.error("[Autovit] Eroare la sincronizare (uploadImages):", err.message);
  }
})();
      // --- END AUTOVIT: SYNC DUPĂ UPLOAD IMAGINE ---


    });
    uploadStream.end(imageBuffer);
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ message: "Eroare internă la procesarea imaginii." });
  }
};

const createListing = async (req, res) => {
  const { title, description, categoryId, attributes, purchasePrice, otherCosts } = req.body;
  const { businessId } = req.user;
  try {
    const newListing = await prisma.$transaction(async (prisma) => {
      const category = await prisma.category.findFirst({ where: { id: categoryId, businessId: businessId }, include: { attributes: true } });
      if (!category) throw new Error("Categoria nu a fost găsită sau nu aveți acces la ea.");
      let priceValue = null;
      let mileageValue = null;
      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          const definedAttribute = category.attributes.find((a) => a.id === attr.attributeId);
          if (definedAttribute?.name.toLowerCase() === "price" || definedAttribute?.name.toLowerCase() === "pret") priceValue = parseFloat(attr.value);
          if (definedAttribute?.name.toLowerCase() === "kilometraj") mileageValue = parseInt(attr.value, 10);
        }
      }
      const listing = await prisma.listing.create({
        data: { title, description, businessId, categoryId, price: priceValue, mileage: mileageValue, purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null, otherCosts: otherCosts ? parseFloat(otherCosts) : null, slug: generateSlug(title) },
      });
      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          const definedAttribute = category.attributes.find((a) => a.id === attr.attributeId);
          if (!definedAttribute) throw new Error(`Atribut invalid: ${attr.attributeId}`);
          const valueData = { listingId: listing.id, attributeId: attr.attributeId };
          if (definedAttribute.type === "STRING") valueData.stringValue = attr.value;
          else if (definedAttribute.type === "NUMBER") valueData.numberValue = parseFloat(attr.value);
          else if (definedAttribute.type === "BOOLEAN") valueData.booleanValue = Boolean(attr.value);
          await prisma.attributeValue.create({ data: valueData });
        }
      }
      return listing;
    });

    const newListingId = newListing.id;

    // --- INTEGRATION BESTAUTO: CREATE ---
    ;(async () => {
      try {
        const fullListing = await prisma.listing.findUnique({
          where: { id: newListingId },
          include: { business: true, attributeValues: { include: { attribute: true } }, images: true },
        });
        if (fullListing?.business?.bestAutoApiKey) {
          await bestAutoService.publishListing(fullListing, fullListing.business.bestAutoApiKey);
        }
      } catch (err) {
        console.error("[BestAuto] Eroare la sincronizare (create):", err.message);
      }
    })();
    // --- END BESTAUTO: CREATE ---

    res.status(201).json(newListing);
  } catch (error) {
    res.status(400).json({ message: error.message || "Eroare la crearea anunțului." });
  }
};

const getListings = async (req, res) => {
  const { businessId } = req.user;
  const listings = await prisma.listing.findMany({
    where: { businessId, status: "AVAILABLE" },
    include: {
      category: { select: { name: true } },
      attributeValues: { include: { attribute: { select: { name: true, type: true } } } },
      images: { orderBy: { order: "asc" } },
      _count: { select: { views: true } },
    },
  });
  res.status(200).json(listings);
};

const getSoldListings = async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: "Business ID is required." });
  const listings = await prisma.listing.findMany({
    where: { businessId, status: "SOLD" },
    include: { category: { select: { name: true } }, images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { soldAt: "desc" },
    take: req.query.limit ? parseInt(req.query.limit) : undefined,
  });
  res.status(200).json(listings);
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
  const { title, description, attributes, purchasePrice, otherCosts } = req.body;
  const { businessId } = req.user;

  try {
    await prisma.$transaction(async (prisma) => {
      const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId } });
      if (!listing) throw new Error("Anunțul nu a fost găsit sau nu aveți acces la el.");

      let priceValue = listing.price;
      let mileageValue = listing.mileage;

      if (attributes && Array.isArray(attributes)) {
        const categoryAttributes = await prisma.attribute.findMany({ where: { categoryId: listing.categoryId } });
        for (const attr of attributes) {
          const definedAttribute = categoryAttributes.find((a) => a.id === attr.attributeId);
          if (definedAttribute?.name.toLowerCase() === "price" || definedAttribute?.name.toLowerCase() === "pret") priceValue = parseFloat(attr.value);
          if (definedAttribute?.name.toLowerCase() === "kilometraj") mileageValue = parseInt(attr.value, 10);
        }
      }

      await prisma.listing.update({
        where: { id: listingId },
        data: { title, description, price: priceValue, mileage: mileageValue, purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null, otherCosts: otherCosts ? parseFloat(otherCosts) : null, slug: generateSlug(title) },
      });

      if (attributes && Array.isArray(attributes)) {
        await prisma.attributeValue.deleteMany({ where: { listingId } });
        const categoryAttributes = await prisma.attribute.findMany({ where: { categoryId: listing.categoryId } });
        for (const attr of attributes) {
          const definedAttribute = categoryAttributes.find((a) => a.id === attr.attributeId);
          if (!definedAttribute) continue;
          const valueData = { listingId, attributeId: attr.attributeId };
          if (definedAttribute.type === "STRING") valueData.stringValue = attr.value;
          else if (definedAttribute.type === "NUMBER") valueData.numberValue = parseFloat(attr.value);
          else if (definedAttribute.type === "BOOLEAN") valueData.booleanValue = attr.value === "true" || attr.value === true;
          else if (definedAttribute.type === "DATE") valueData.dateValue = new Date(attr.value);
          await prisma.attributeValue.create({ data: valueData });
        }
      }
    });

    // --- INTEGRATION BESTAUTO: UPDATE ---
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
        console.error("[BestAuto] Eroare la sincronizare (update):", err.message);
      }
    })();
    // --- END BESTAUTO: UPDATE ---

    // --- INTEGRATION AUTOVIT: UPDATE ---
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
    // --- END AUTOVIT: UPDATE ---

    const updatedListing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { images: true, attributeValues: true },
    });

    res.status(200).json(updatedListing);
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
    await prisma.$transaction(async (prisma) => {
      const listing = await prisma.listing.findFirst({ where: { id: listingId, businessId } });
      if (!listing) throw new Error("Anunțul nu a fost găsit sau nu aveți acces la el.");
      await prisma.attributeValue.deleteMany({ where: { listingId } });
      await prisma.listing.delete({ where: { id: listingId } });
    });

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
          await autovitService.deleteAdvert(autovitId, token, autovitUsername);
        }
      } catch (err) {
        console.error("[Autovit] Eroare la ștergere:", err.message);
      }
    })();
    // --- END AUTOVIT: DELETE ---

    res.status(200).json({ message: "Anunțul a fost șters." });
  } catch (error) {
    res.status(404).json({ message: error.message || "Eroare la ștergerea anunțului." });
  }
};

const getListingById = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId: businessId },
      include: { attributeValues: { include: { attribute: { select: { name: true } } } }, images: { orderBy: { order: "asc" } } },
    });
    if (!listing) return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    res.status(200).json(listing);
  } catch (error) {
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
    const newClonedListing = await prisma.$transaction(async (tx) => {
      const originalListing = await tx.listing.findFirst({ where: { id: listingId, businessId: businessId }, include: { attributeValues: true } });
      if (!originalListing) throw new Error("Anunțul original nu a fost găsit sau nu aveți acces.");
      const newListing = await tx.listing.create({
        data: { title: `${originalListing.title} [CLONĂ]`, description: originalListing.description, price: originalListing.price, mileage: originalListing.mileage, purchasePrice: originalListing.purchasePrice, otherCosts: originalListing.otherCosts, status: "AVAILABLE", soldAt: null, sellingPrice: null, businessId: originalListing.businessId, categoryId: originalListing.categoryId },
      });
      if (originalListing.attributeValues.length > 0) {
        await tx.attributeValue.createMany({
          data: originalListing.attributeValues.map((attr) => ({ stringValue: attr.stringValue, numberValue: attr.numberValue, booleanValue: attr.booleanValue, attributeId: attr.attributeId, listingId: newListing.id })),
        });
      }
      return newListing;
    });
    res.status(201).json(newClonedListing);
  } catch (error) {
    console.error("[DEBUG] Eroare la clonarea anunțului:", error);
    res.status(404).json({ message: error.message || "Eroare la clonarea anunțului." });
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