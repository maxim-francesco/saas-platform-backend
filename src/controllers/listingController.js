// src/controllers/listingController.js
const sharp = require("sharp");
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const axios = require("axios");
const bestAutoService = require("../services/bestAutoService");

// Adaugă această funcție la începutul fișierului
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Înlocuiește spațiile cu -
    .replace(/[^\w\-]+/g, '') // Elimină caracterele non-alfanumerice (ex: puncte, paranteze)
    .replace(/\-\-+/g, '-');  // Elimină liniuțele duble
};

// src/controllers/listingController.js

const uploadImages = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;
  const rotation = parseInt(req.body.rotation || "0", 10);

  // Setăm o lățime standard mare pentru calitate (Full HD -ish)
  // Înălțimea va fi calculată automat pentru a nu tăia imaginea.
  const STANDARD_WIDTH = 1600; 

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

    // 1. Procesăm imaginea de bază
    // Folosim doar 'width', fără 'height', pentru a păstra aspect ratio original
    let processedImagePipeline = sharp(req.file.buffer)
      .rotate() // Citește orientarea EXIF originală
      .rotate(rotation) // Aplică rotația cerută de user
      .resize({ 
        width: STANDARD_WIDTH, 
        withoutEnlargement: false // Permitem mărirea dacă poza e mică, pt consistența bannerului
      });

    // 2. Obținem buffer-ul și metadatele noii imagini redimensionate
    let imageBuffer = await processedImagePipeline.toBuffer();
    const metadata = await sharp(imageBuffer).metadata();
    
    // 3. Aplicăm Banner-ul (dacă există)
    if (business.bannerUrl) {
      const BANNER_HEIGHT = 150; // Înălțimea bannerului (o facem puțin mai mare pt rezoluția asta)

      try {
        const bannerResponse = await axios({
          url: business.bannerUrl,
          responseType: "arraybuffer",
        });
        const bannerInputBuffer = Buffer.from(bannerResponse.data, "binary");

        // Redimensionăm bannerul să aibă ACEEAȘI lățime cu imaginea
        const bannerResizedBuffer = await sharp(bannerInputBuffer)
          .resize({
            width: metadata.width, // 1600
            height: BANNER_HEIGHT,
            fit: "fill", // Forțăm bannerul să umple spațiul
          })
          .toBuffer();

        // Extindem imaginea jos și lipim bannerul
        imageBuffer = await sharp(imageBuffer)
          .extend({
            bottom: BANNER_HEIGHT,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .composite([{ input: bannerResizedBuffer, gravity: "south" }])
          .jpeg({ quality: 90 })
          .toBuffer();
          
      } catch (err) {
        console.error("Eroare la aplicarea bannerului:", err);
        // Dacă eșuează bannerul, folosim imaginea originală procesată, nu dăm crash
        imageBuffer = await processedImagePipeline.jpeg({ quality: 90 }).toBuffer();
      }
    } else {
      // Dacă nu are banner, doar o convertim în JPEG optimizat
      imageBuffer = await sharp(imageBuffer).jpeg({ quality: 90 }).toBuffer();
    }

    // 4. Upload pe Cloudinary
    const folderPath = `saas-platform/${businessId}/${listing.id}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "image", folder: folderPath },
      async (error, result) => {
        if (error)
          return res
            .status(500)
            .json({ message: "Eroare la upload Cloudinary." });

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
  const {
    title,
    description,
    categoryId,
    attributes,
    purchasePrice,
    otherCosts,
  } = req.body;
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
          price: priceValue,
          mileage: mileageValue,
          // --- LINII NOI ADĂUGATE ---
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
          otherCosts: otherCosts ? parseFloat(otherCosts) : null,
          // --- SFÂRȘIT LINII NOI ---
          slug: generateSlug(title),
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

    // --- INTEGRATION BESTAUTO START ---
    // Sincronizăm asincron (fără await) pentru a nu bloca răspunsul către frontend
    const newListingId = newListing.id;
    (async () => {
      try {
        // 1. Căutăm anunțul complet (inclusiv imagini și business pentru cheia API)
        const fullListing = await prisma.listing.findUnique({
          where: { id: newListingId },
          include: {
            business: true,
            attributeValues: { include: { attribute: true } },
            images: true,
          },
        });

        // 2. Verificăm dacă business-ul are cheia API setată
        if (fullListing?.business?.bestAutoApiKey) {
          await bestAutoService.publishListing(
            fullListing,
            fullListing.business.bestAutoApiKey
          );
        }
      } catch (err) {
        console.error("[BestAuto] Eroare la sincronizare (create):", err.message);
      }
    })();
    // --- INTEGRATION BESTAUTO END ---


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
  const { title, description, attributes, purchasePrice, otherCosts,youtubeVideoId } =
    req.body;
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
          // --- LINII NOI ADĂUGATE ---
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
          otherCosts: otherCosts ? parseFloat(otherCosts) : null,
          youtubeVideoId,
          // --- SFÂRȘIT LINII NOI ---
          slug: generateSlug(title),
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

    // --- INTEGRATION BESTAUTO START ---
    (async () => {
      try {
        // 1. Luăm datele actualizate
        const fullListing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: {
            business: true,
            attributeValues: { include: { attribute: true } },
            images: true,
          },
        });

        // 2. Trimitem update-ul
        if (fullListing?.business?.bestAutoApiKey) {
          await bestAutoService.publishListing(
            fullListing,
            fullListing.business.bestAutoApiKey
          );
        }
      } catch (err) {
        console.error("[BestAuto] Eroare la sincronizare (update):", err.message);
      }
    })();
    // --- INTEGRATION BESTAUTO END ---

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

  // --- INTEGRATION BESTAUTO PART 1 ---
  // Căutăm cheia API înainte să ștergem anunțul/business-ul, ca să o avem pregătită
  let bestAutoApiKey = null;
  try {
    const businessData = await prisma.business.findUnique({
      where: { id: businessId },
      select: { bestAutoApiKey: true },
    });
    bestAutoApiKey = businessData?.bestAutoApiKey;
  } catch (e) {
    console.error("Eroare la preluare cheie API pentru delete:", e);
  }
  // -----------------------------------

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

    // --- INTEGRATION BESTAUTO PART 2 ---
    if (bestAutoApiKey) {
      // Apelăm ștergerea asincron
      bestAutoService
        .deleteListing(listingId, bestAutoApiKey)
        .catch((err) => console.error("[BestAuto] Eroare la ștergere:", err.message));
    }
    // -----------------------------------

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
        attributeValues: {
          // <--- ÎNLOCUIEȘTE AICI
          include: {
            attribute: {
              select: { name: true }, // Asigură-te că includem numele atributului
            },
          },
        },
        images: {
          orderBy: { order: "asc" },
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

const cloneListing = async (req, res) => {
  const { listingId } = req.params;
  const { businessId } = req.user;

  try {
    const newClonedListing = await prisma.$transaction(async (tx) => {
      // 1. Găsim anunțul original și ne asigurăm că aparține acestui business
      const originalListing = await tx.listing.findFirst({
        where: {
          id: listingId,
          businessId: businessId,
        },
        include: {
          attributeValues: true, // Includem toate valorile atributelor
        },
      });

      if (!originalListing) {
        throw new Error("Anunțul original nu a fost găsit sau nu aveți acces.");
      }

      // 2. Creăm noul anunț (clona)
      // Adăugăm "[CLONĂ]" în titlu pentru a-l diferenția
      // Resetăm statusul la "AVAILABLE" și ștergem datele de vânzare
      const newListing = await tx.listing.create({
        data: {
          title: `${originalListing.title} [CLONĂ]`,
          description: originalListing.description,
          price: originalListing.price,
          mileage: originalListing.mileage,
          purchasePrice: originalListing.purchasePrice,
          otherCosts: originalListing.otherCosts,
          status: "AVAILABLE", // O clonă este mereu disponibilă
          soldAt: null,
          sellingPrice: null,

          // Legăturile
          businessId: originalListing.businessId,
          categoryId: originalListing.categoryId,
        },
      });

      // 3. Copiem toate valorile atributelor
      if (originalListing.attributeValues.length > 0) {
        // Pregătim datele pentru creare în masă
        const attributeValuesToCreate = originalListing.attributeValues.map(
          (attr) => ({
            stringValue: attr.stringValue,
            numberValue: attr.numberValue,
            booleanValue: attr.booleanValue,
            attributeId: attr.attributeId,
            listingId: newListing.id, // Legăm de ID-ul NOULUI anunț
          })
        );

        // Folosim createMany pentru performanță
        await tx.attributeValue.createMany({
          data: attributeValuesToCreate,
        });
      }

      // 4. Returnăm noul anunț. NU copiem imaginile sau vizualizările.
      return newListing;
    });

    // Trimitem înapoi anunțul nou creat
    res.status(201).json(newClonedListing);
  } catch (error) {
    console.error("[DEBUG] Eroare la clonarea anunțului:", error);
    res
      .status(404)
      .json({ message: error.message || "Eroare la clonarea anunțului." });
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
  cloneListing,
};
