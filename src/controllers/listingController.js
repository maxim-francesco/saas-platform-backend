// src/controllers/listingController.js
const prisma = require("../config/prismaClient");

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

  try {
    const listings = await prisma.listing.findMany({
      where: { businessId },
      include: {
        category: { select: { name: true } },
        attributeValues: {
          include: {
            attribute: { select: { name: true, type: true } },
          },
        },
      },
    });
    res.status(200).json(listings);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea anunțurilor." });
  }
};

// Funcția de a actualiza un anunț
const updateListing = async (req, res) => {
  const { listingId } = req.params;
  const { title, description, attributes } = req.body;
  const { businessId } = req.user;

  try {
    await prisma.$transaction(async (prisma) => {
      // 1. Verificăm dacă anunțul există și aparține business-ului
      const listing = await prisma.listing.findFirst({
        where: { id: listingId, businessId },
      });

      if (!listing) {
        throw new Error("Anunțul nu a fost găsit sau nu aveți acces la el.");
      }

      // 2. Actualizăm datele de bază ale anunțului
      await prisma.listing.update({
        where: { id: listingId },
        data: { title, description },
      });

      // 3. Dacă au fost trimise atribute noi, le actualizăm
      if (attributes && Array.isArray(attributes)) {
        // Strategia "Delete & Create": ștergem toate valorile vechi...
        await prisma.attributeValue.deleteMany({ where: { listingId } });

        // ... și le creăm din nou pe cele noi (similar cu logica din `createListing`)
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
            value.numberValue = parseFloat(attr.value);
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

module.exports = { createListing, getListings, updateListing, deleteListing };
