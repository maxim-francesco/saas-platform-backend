// src/controllers/listingController.js
const sharp = require("sharp");
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const axios = require("axios");

const uploadImages = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  const rotation = parseInt(req.body.rotation || "0", 10);

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

    const mainImage = sharp(req.file.buffer)
      .rotate()
      .rotate(rotation)
      .resize({ width: 800, height: 600, fit: "cover" });

    if (business.bannerUrl) {
      const bannerResponse = await axios({
        url: business.bannerUrl,
        responseType: "arraybuffer",
      });
      const bannerBuffer = Buffer.from(bannerResponse.data, "binary");
      const bannerImage = sharp(bannerBuffer).resize({
        width: 800,
        height: 120,
        fit: "fill",
      });
      const bannerResizedBuffer = await bannerImage.toBuffer();
      imageBuffer = await mainImage
        .extend({
          bottom: 120,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .composite([{ input: bannerResizedBuffer, gravity: "south" }])
        .jpeg()
        .toBuffer();
    } else {
      imageBuffer = await mainImage.jpeg().toBuffer();
    }

    const folderPath = `saas-platform/${businessId}/${listing.id}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "image", folder: folderPath },
      async (error, result) => {
        if (error)
          return res
            .status(500)
            .json({ message: "Eroare la upload Cloudinary." });

        // --- ✅ AICI ESTE MODIFICAREA CHEIE: Folosim o tranzacție ---
        // Acest bloc asigură că operațiunile de citire (count) și scriere (create)
        // se execută ca un singur pas, prevenind "race conditions".
        const image = await prisma.$transaction(async (tx) => {
          const imageCount = await tx.listingImage.count({
            where: { listingId: listingId },
          });

          const newImage = await tx.listingImage.create({
            data: {
              url: result.secure_url,
              listingId: listingId,
              order: imageCount,
            },
          });

          return newImage;
        });
        // --- SFÂRȘIT MODIFICARE ---

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
// Asigură-te că funcția getListings arată așa:
const getListings = async (req, res) => {
  const { businessId } = req.user;
  const listings = await prisma.listing.findMany({
    where: {
      businessId,
      status: "AVAILABLE", // <-- Condiția cheie adăugată
    },
    include: {
      category: { select: { name: true } },
      attributeValues: {
        include: { attribute: { select: { name: true, type: true } } },
      },
      images: {
        orderBy: { order: "asc" }, // <-- ✅ ACEASTĂ LINIE ESTE CRUCIALĂ
      },
      _count: {
        select: { views: true },
      },
    },
  });
  res.status(200).json(listings);
};

// Adaugă această funcție nouă
const getSoldListings = async (req, res) => {
  // NEW: Get businessId from either the authenticated user OR the query params
  const businessId = req.user?.businessId || req.query.businessId;

  // Add a check to ensure we have a businessId
  if (!businessId) {
    return res.status(400).json({ message: "Business ID is required." });
  }

  const listings = await prisma.listing.findMany({
    where: {
      businessId, // Use the dynamically found businessId
      status: "SOLD",
    },
    include: {
      category: { select: { name: true } },
      images: { orderBy: { order: "asc" }, take: 1 },
    },
    orderBy: {
      soldAt: "desc",
    },
    // Add a limit for public requests to avoid fetching too much data
    take: req.query.limit ? parseInt(req.query.limit) : undefined,
  });
  res.status(200).json(listings);
};

// Adaugă și această funcție
const markAsSold = async (req, res) => {
  const { listingId } = req.params;
  const { sellingPrice, soldAt } = req.body;
  const { businessId } = req.user;

  if (!sellingPrice || !soldAt) {
    return res
      .status(400)
      .json({ message: "Prețul de vânzare și data sunt obligatorii." });
  }

  try {
    await prisma.listing.updateMany({
      where: { id: listingId, businessId },
      data: {
        status: "SOLD",
        sellingPrice: parseFloat(sellingPrice),
        soldAt: new Date(soldAt),
      },
    });
    res.status(200).json({ message: "Anunțul a fost marcat ca vândut." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Eroare la marcarea anunțului ca vândut." });
  }
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
        images: {
          orderBy: { order: "asc" }, // <-- ✅ ȘI ACEASTĂ LINIE ESTE CRUCIALĂ
        },
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
// Înlocuiește funcția deleteImage existentă cu aceasta:

const deleteImage = async (req, res) => {
  const { listingId, imageId } = req.params;
  const { businessId } = req.user;

  try {
    // Verificăm dacă imaginea există și aparține utilizatorului logat
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

    // --- START LOGICĂ NOUĂ ---

    // 1. Extragem ID-ul public din URL-ul imaginii de pe Cloudinary
    //    URL-ul arată cam așa: .../upload/v12345/folder/nume_fisier.jpg
    //    ID-ul public este: folder/nume_fisier
    const publicIdMatch = imageToDelete.url.match(/upload\/(?:v\d+\/)?(.+?)\./);

    if (publicIdMatch && publicIdMatch[1]) {
      const publicId = publicIdMatch[1];

      // 2. Trimitem comanda de ștergere către Cloudinary
      await cloudinary.uploader.destroy(publicId);
    } else {
      // Dacă nu putem extrage ID-ul, nu oprim procesul, dar înregistrăm o eroare
      console.error(
        "Nu s-a putut extrage ID-ul public din URL:",
        imageToDelete.url
      );
    }

    // --- FINAL LOGICĂ NOUĂ ---

    // 3. Ștergem imaginea din baza noastră de date (acest pas exista deja)
    await prisma.listingImage.delete({ where: { id: imageId } });

    res.status(200).json({
      message: "Imaginea a fost ștearsă cu succes (DB & Cloudinary).",
    });
  } catch (error) {
    console.error("Eroare la ștergerea imaginii:", error);
    res.status(500).json({ message: "Eroare internă la ștergerea imaginii." });
  }
};

const updateImageOrder = async (req, res) => {
  console.log(
    `[SPION] S-a primit o cerere de re-ordonare pentru anunțul ${req.params.listingId}`
  );
  const { listingId } = req.params;
  const { imageIds } = req.body;
  const { businessId } = req.user;

  // --- LOG-URI PENTRU DEBUG ---
  console.log(
    `[DEBUG] Primit cerere de reordonare pentru listingId: ${listingId}`
  );
  console.log(`[DEBUG] Body-ul cererii (req.body):`, req.body);
  console.log(`[DEBUG] Array-ul de ID-uri extras (imageIds):`, imageIds);
  // --- SFÂRȘIT LOG-URI ---

  if (!Array.isArray(imageIds)) {
    console.log("[DEBUG] EROARE: imageIds nu este un array.");
    return res
      .status(400)
      .json({ message: "Este necesar un array de ID-uri." });
  }

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
    });
    if (!listing) {
      console.log(
        "[DEBUG] EROARE: Anunțul nu a fost găsit pentru acest business."
      );
      return res.status(404).json({ message: "Anunț negăsit." });
    }

    console.log(
      `[DEBUG] Se pregătesc ${imageIds.length} operațiuni de update.`
    );

    const updatePromises = imageIds.map((imageId, index) => {
      console.log(
        ` -> Pregătire update: imaginea cu ID ${imageId} va primi order = ${index}`
      );
      return prisma.listingImage.update({
        where: { id: imageId },
        data: { order: index },
      });
    });

    await prisma.$transaction(updatePromises);

    console.log("[DEBUG] Tranzacția de update a fost finalizată cu succes.");
    res.status(200).json({ message: "Ordinea imaginilor a fost actualizată." });
  } catch (error) {
    console.error("[DEBUG] EROARE MAJORĂ în updateImageOrder:", error);
    res
      .status(500)
      .json({ message: "Eroare la actualizarea ordinii imaginilor." });
  }
};

const reactivateListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const result = await prisma.listing.updateMany({
      where: { id: listingId, businessId },
      data: {
        status: "AVAILABLE",
        // Resetăm datele de vânzare pentru curățenia datelor
        soldAt: null,
        sellingPrice: null,
      },
    });

    if (result.count === 0) {
      return res
        .status(404)
        .json({ message: "Anunțul vândut nu a fost găsit." });
    }

    res.status(200).json({
      message: "Anunțul a fost reactivat și mutat înapoi la vânzare.",
    });
  } catch (error) {
    res.status(500).json({ message: "Eroare la reactivarea anunțului." });
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
  updateImageOrder,
  getSoldListings,
  markAsSold,
  reactivateListing,
};
