// src/controllers/listingController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");

// ADAUGĂ ACEASTĂ FUNCȚIE NOUĂ
const uploadImages = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
    });
    if (!listing) return res.status(404).json({ message: "Anunț negăsit." });
    if (!req.file)
      return res.status(400).json({ message: "Niciun fișier încărcat." });

    const folderPath = `saas-platform/${listing.businessId}/${listing.id}`;
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
    uploadStream.end(req.file.buffer);
  } catch (error) {
    res.status(500).json({ message: "Eroare internă server." });
  }
};

// Funcția de creare a unui nou anunț
const createListing = async (req, res) => {
  const { title, description, categoryId, attributes } = req.body;
  const { businessId } = req.user;

  // Validare de bază
  if (!title || !categoryId || !attributes || !Array.isArray(attributes)) {
    return res.status(400).json({
      message:
        "Titlul, ID-ul categoriei și o listă de atribute sunt obligatorii.",
    });
  }

  try {
    // Folosim o tranzacție pentru a garanta integritatea datelor
    const newListing = await prisma.$transaction(async (prisma) => {
      // Pas 1: Verificăm dacă categoria aparține business-ului. Securitate!
      const category = await prisma.category.findFirst({
        where: { id: categoryId, businessId: businessId },
        include: { attributes: true }, // Includem atributele definite pentru a le valida
      });

      if (!category) {
        throw new Error("Categoria nu a fost găsită sau nu aveți acces la ea.");
      }

      // Pas 2: Creăm anunțul de bază
      const listing = await prisma.listing.create({
        data: {
          title,
          description,
          businessId,
          categoryId,
        },
      });

      // Pas 3: Iterăm prin atributele trimise în request și le salvăm
      for (const attr of attributes) {
        // Verificăm dacă atributul trimis există în definiția categoriei
        const definedAttribute = category.attributes.find(
          (a) => a.id === attr.attributeId
        );
        if (!definedAttribute) {
          throw new Error(
            `Atributul cu ID ${attr.attributeId} nu este valid pentru această categorie.`
          );
        }

        // Pregătim datele pentru salvare, completând coloana corectă (stringValue, numberValue etc.)
        const valueData = {
          listingId: listing.id,
          attributeId: attr.attributeId,
        };

        if (definedAttribute.type === "STRING") {
          valueData.stringValue = attr.value;
        } else if (definedAttribute.type === "NUMBER") {
          // Convertim valoarea la număr
          valueData.numberValue = parseFloat(attr.value);
        } else if (definedAttribute.type === "BOOLEAN") {
          // Convertim valoarea la boolean
          valueData.booleanValue = Boolean(attr.value);
        }

        await prisma.attributeValue.create({ data: valueData });
      }

      return listing;
    });

    res.status(201).json(newListing);
  } catch (error) {
    // Dacă apare orice eroare în tranzacție, Prisma face rollback automat
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
  const { businessId } = req.user;

  // --- LOGGING PENTRU DEBUG ---
  console.log(`[DEBUG] Încercare de update pentru listingId: ${listingId}`);
  console.log(`[DEBUG] Acțiune efectuată de businessId: ${businessId}`);
  // --- SFÂRȘIT LOGGING ---

  try {
    await prisma.$transaction(async (prisma) => {
      const listing = await prisma.listing.findFirst({
        where: {
          id: listingId,
          businessId: businessId, // Condiția cheie de securitate
        },
      });

      // --- LOGGING PENTRU DEBUG ---
      if (!listing) {
        console.log(
          `[DEBUG] REZULTAT: Anunțul NU a fost găsit pentru acest business. Se returnează 404.`
        );
        throw new Error("Anunțul nu a fost găsit sau nu aveți acces la el.");
      } else {
        console.log(
          `[DEBUG] REZULTAT: Anunțul a fost găsit. Se continuă cu update-ul.`
        );
      }
      // --- SFÂRȘIT LOGGING ---

      // ... restul logicii de update (rămâne neschimbată) ...
      const { title, description, attributes } = req.body;
      await prisma.listing.update({
        where: { id: listingId },
        data: { title, description },
      });

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
