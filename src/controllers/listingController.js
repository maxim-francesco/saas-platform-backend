// src/controllers/listingController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const axios = require("axios");

// ADAUGĂ ACEASTĂ FUNCȚIE NOUĂ
const uploadImages = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    if (!req.file)
      return res.status(400).json({ message: "Niciun fișier încărcat." });

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
    });
    if (!listing) return res.status(404).json({ message: "Anunț negăsit." });

    let imageBuffer = req.file.buffer;

    // --- Aici se întâmplă magia ---
    if (business.bannerUrl) {
      // Descarcă banner-ul din Cloudinary
      const bannerResponse = await axios({
        url: business.bannerUrl,
        responseType: "arraybuffer",
      });
      const bannerBuffer = Buffer.from(bannerResponse.data, "binary");

      // Procesează imaginea principală și banner-ul cu Sharp
      const mainImage = sharp(req.file.buffer).resize({ width: 800 }); // Redimensionăm imaginea principală
      const bannerImage = sharp(bannerBuffer).resize({ width: 800 }); // Redimensionăm banner-ul la aceeași lățime
      const bannerMetadata = await bannerImage.metadata();

      // Combinăm cele două imagini
      imageBuffer = await mainImage
        .extend({
          bottom: bannerMetadata.height,
          background: { r: 255, g: 255, b: 255, alpha: 1 }, // Fundal alb
        })
        .composite([{ input: bannerBuffer, gravity: "south" }])
        .jpeg() // Convertim la JPEG
        .toBuffer();
    }
    // --- Sfârșitul magiei ---

    const folderPath = `saas-platform/${businessId}/${listing.id}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "image", folder: folderPath },
      async (error, result) => {
        if (error)
          return res
            .status(500)
            .json({ message: "Eroare la upload Cloudinary." });

        const image = await prisma.listingImage.create({
          data: { url: result.secure_url, listingId: listingId },
        });
        res.status(201).json(image);
      }
    );

    uploadStream.end(imageBuffer);
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ message: "Eroare internă la procesarea imaginii." });
  }
};

// Funcția de creare a unui nou anunț
const createListing = async (req, res) => {
  const { title, description, categoryId, attributes } = req.body;
  const { businessId } = req.user;

  try {
    const newListing = await prisma.$transaction(async (prisma) => {
      // 1. Găsim categoria și atributele ei predefinite pentru validare
      const category = await prisma.category.findFirst({
        where: { id: categoryId, businessId: businessId },
        include: { attributes: true },
      });
      if (!category) {
        throw new Error("Categoria nu a fost găsită sau nu aveți acces la ea.");
      }

      // 2. Extragem prețul și kilometrajul din atributele primite în request
      let priceValue = null;
      let mileageValue = null;
      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          const definedAttribute = category.attributes.find(
            (a) => a.id === attr.attributeId
          );
          // Căutăm insensibil la majuscule/minuscule
          if (
            definedAttribute?.name.toLowerCase() === "price" ||
            definedAttribute?.name.toLowerCase() === "pret"
          ) {
            priceValue = parseFloat(attr.value);
          }
          if (definedAttribute?.name.toLowerCase() === "kilometraj") {
            mileageValue = parseInt(attr.value, 10);
          }
        }
      }

      // 3. Creăm anunțul de bază, incluzând noile câmpuri
      const listing = await prisma.listing.create({
        data: {
          title,
          description,
          businessId,
          categoryId,
          price: priceValue, // Salvăm prețul în coloana dedicată
          mileage: mileageValue, // Salvăm kilometrajul în coloana dedicată
        },
      });

      // 4. Salvăm TOATE atributele în mod dinamic, ca și până acum
      if (attributes && Array.isArray(attributes)) {
        for (const attr of attributes) {
          const definedAttribute = category.attributes.find(
            (a) => a.id === attr.attributeId
          );
          if (!definedAttribute)
            throw new Error(`Atribut invalid: ${attr.attributeId}`);

          const valueData = {
            listingId: listing.id,
            attributeId: attr.attributeId,
          };
          if (definedAttribute.type === "STRING")
            valueData.stringValue = attr.value;
          else if (definedAttribute.type === "NUMBER")
            valueData.numberValue = parseFloat(attr.value);
          else if (definedAttribute.type === "BOOLEAN")
            valueData.booleanValue = Boolean(attr.value);

          await prisma.attributeValue.create({ data: valueData });
        }
      }

      return listing;
    });
    res.status(201).json(newListing);
  } catch (error) {
    res
      .status(400)
      .json({ message: error.message || "Eroare la crearea anunțului." });
  }
};

// Funcția de a prelua toate anunțurile unui business
const getListings = async (req, res) => {
  const { businessId } = req.user;
  const listings = await prisma.listing.findMany({
    where: { businessId },
    include: {
      category: { select: { name: true } },
      attributeValues: {
        include: { attribute: { select: { name: true, type: true } } },
      },
      images: { select: { url: true }, take: 1 }, // Adaugă această linie
    },
  });
  res.status(200).json(listings);
};

// Funcția de a actualiza un anunț
// Înlocuiește funcția existentă cu aceasta
const updateListing = async (req, res) => {
  const { listingId } = req.params;
  const { title, description, attributes } = req.body;
  const { businessId } = req.user;

  try {
    await prisma.$transaction(async (prisma) => {
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, businessId },
      });
      if (!listing) {
        throw new Error("Anunțul nu a fost găsit sau nu aveți acces la el.");
      }

      // 1. Extragem prețul și kilometrajul din atributele primite în request
      let priceValue = listing.price; // Păstrăm valorile vechi ca default
      let mileageValue = listing.mileage;
      if (attributes && Array.isArray(attributes)) {
        const categoryAttributes = await prisma.attribute.findMany({
          where: { categoryId: listing.categoryId },
        });
        for (const attr of attributes) {
          const definedAttribute = categoryAttributes.find(
            (a) => a.id === attr.attributeId
          );
          if (
            definedAttribute?.name.toLowerCase() === "price" ||
            definedAttribute?.name.toLowerCase() === "pret"
          )
            priceValue = parseFloat(attr.value);
          if (definedAttribute?.name.toLowerCase() === "kilometraj")
            mileageValue = parseInt(attr.value, 10);
        }
      }

      // 2. Actualizăm anunțul, incluzând noile câmpuri
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          title,
          description,
          price: priceValue,
          mileage: mileageValue,
        },
      });

      // 3. Actualizăm TOATE atributele folosind strategia "Delete & Create"
      if (attributes && Array.isArray(attributes)) {
        await prisma.attributeValue.deleteMany({ where: { listingId } });
        const categoryAttributes = await prisma.attribute.findMany({
          where: { categoryId: listing.categoryId },
        });
        for (const attr of attributes) {
          const definedAttribute = categoryAttributes.find(
            (a) => a.id === attr.attributeId
          );
          if (!definedAttribute)
            throw new Error(`Atribut invalid: ${attr.attributeId}`);

          const valueData = { listingId, attributeId: attr.attributeId };
          if (definedAttribute.type === "STRING")
            valueData.stringValue = attr.value;
          else if (definedAttribute.type === "NUMBER")
            valueData.numberValue = parseFloat(attr.value);
          else if (definedAttribute.type === "BOOLEAN")
            valueData.booleanValue = Boolean(attr.value);

          await prisma.attributeValue.create({ data: valueData });
        }
      }
    });

    res.status(200).json({ message: "Anunțul a fost actualizat cu succes." });
  } catch (error) {
    res
      .status(404)
      .json({ message: error.message || "Eroare la actualizarea anunțului." });
  }
};

// Funcția de a șterge un anunț
const deleteListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    await prisma.$transaction(async (prisma) => {
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, businessId },
      });

      if (!listing) {
        throw new Error("Anunțul nu a fost găsit sau nu aveți acces la el.");
      }

      // 1. Ștergem valorile atributelor asociate
      await prisma.attributeValue.deleteMany({ where: { listingId } });

      // 2. Ștergem anunțul
      await prisma.listing.delete({ where: { id: listingId } });
    });

    res.status(200).json({ message: "Anunțul a fost șters." });
  } catch (error) {
    res
      .status(404)
      .json({ message: error.message || "Eroare la ștergerea anunțului." });
  }
};

// Înlocuiește funcția getListingById existentă cu aceasta:
const getListingById = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId: businessId },
      include: {
        attributeValues: true,
        images: true, // <-- LINIA CHEIE ADĂUGATĂ
      },
    });
    if (!listing)
      return res.status(404).json({ message: "Anunțul nu a fost găsit." });
    res.status(200).json(listing);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea anunțului." });
  }
};

// Adaugă această funcție NOUĂ în același fișier:
const deleteImage = async (req, res) => {
  const { listingId, imageId } = req.params;
  const { businessId } = req.user;
  try {
    // Verificare de securitate complexă: ștergem o imagine (imageId) care aparține unui anunț (listingId)
    // care, la rândul lui, aparține business-ului utilizatorului logat.
    const imageToDelete = await prisma.listingImage.findFirst({
      where: {
        id: imageId,
        listingId: listingId,
        listing: {
          businessId: businessId,
        },
      },
    });

    if (!imageToDelete) {
      return res
        .status(404)
        .json({ message: "Imaginea nu a fost găsită sau nu aveți acces." });
    }

    // Aici am putea adăuga logica de ștergere și din Cloudinary, dar pentru simplitate o lăsăm momentan.
    await prisma.listingImage.delete({ where: { id: imageId } });

    res.status(200).json({ message: "Imaginea a fost ștearsă." });
  } catch (error) {
    res.status(500).json({ message: "Eroare la ștergerea imaginii." });
  }
};

// Nu uita să o exporți la final!
module.exports = {
  createListing,
  getListings,
  updateListing,
  deleteListing,
  getListingById,
  deleteImage,
  uploadImages,
};
