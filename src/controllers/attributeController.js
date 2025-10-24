// src/controllers/attributeController.js
const prisma = require("../config/prismaClient");

// Funcția pentru a crea un atribut nou pentru o categorie specifică
const createAttribute = async (req, res) => {
  const { categoryId } = req.params; // Preluăm ID-ul categoriei din URL
  const { name, type, attributeGroupId } = req.body; // Preluăm numele și tipul atributului din body
  const { businessId } = req.user; // Preluăm businessId din token

  // Validăm tipul de atribut. Trebuie să fie una din valorile definite în schema Prisma
  const validTypes = ["STRING", "NUMBER", "BOOLEAN"];
  if (!name || !type || !validTypes.includes(type)) {
    return res.status(400).json({
      message:
        "Numele și tipul atributului (STRING, NUMBER, BOOLEAN) sunt obligatorii.",
    });
  }

  try {
    // --- VERIFICARE CRITICĂ DE SECURITATE PENTRU MULTI-TENANCY ---
    // Verificăm dacă categoria aparține business-ului utilizatorului autentificat.
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        businessId: businessId, // Condiția cheie!
      },
    });

    // Dacă nu găsim categoria sau nu aparține acestui business, returnăm eroare.
    if (!category) {
      return res.status(404).json({
        message: "Categoria nu a fost găsită sau nu aveți acces la ea.",
      });
    }
    // --- SFÂRȘIT VERIFICARE DE SECURITATE ---

    const newAttribute = await prisma.attribute.create({
      data: {
        name,
        type,
        categoryId: categoryId,
        attributeGroupId,
      },
    });

    res.status(201).json(newAttribute);
  } catch (error) {
    // Gestionăm cazul în care un atribut cu același nume există deja pt. categorie etc.
    res.status(500).json({ message: "Eroare la crearea atributului.", error });
  }
};

// Funcția pentru a lista toate atributele unei categorii
// Înlocuiește funcția getAttributesForCategory
const getAttributesForCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { businessId } = req.user;

  try {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, businessId: businessId },
    });

    if (!category) {
      return res.status(404).json({
        message: "Categoria nu a fost găsită sau nu aveți acces la ea.",
      });
    }

    const attributes = await prisma.attribute.findMany({
      where: { categoryId: categoryId },
      include: { attributeGroup: { select: { name: true } } }, // Includem numele grupului
    });

    // Grupăm atributele
    const grouped = attributes.reduce((acc, attr) => {
      const groupName = attr.attributeGroup?.name || "Atribute Negrupate";
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(attr);
      return acc;
    }, {});

    res.status(200).json(grouped);
  } catch (error) {
    res.status(500).json({ message: "Eroare la preluarea atributelor." });
  }
};

const updateAttribute = async (req, res) => {
  const { categoryId, attributeId } = req.params;
  const { name, type, attributeGroupId } = req.body;
  const { businessId } = req.user;

  // Validare
  const validTypes = ["STRING", "NUMBER", "BOOLEAN"];
  if (!name || !type || !validTypes.includes(type)) {
    return res
      .status(400)
      .json({ message: "Numele și tipul valid sunt obligatorii." });
  }

  try {
    // Verificăm dacă atributul pe care vrem să-l modificăm chiar aparține
    // unei categorii care aparține business-ului utilizatorului. Securitate!
    const attributeToUpdate = await prisma.attribute.findFirst({
      where: {
        id: attributeId,
        categoryId: categoryId,
        category: {
          businessId: businessId,
        },
      },
    });

    if (!attributeToUpdate) {
      return res
        .status(404)
        .json({ message: "Atributul nu a fost găsit sau nu aveți acces." });
    }

    const updatedAttribute = await prisma.attribute.update({
      where: { id: attributeId },
      data: { name, type, attributeGroupId },
    });

    res.status(200).json(updatedAttribute);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Eroare la actualizarea atributului.", error });
  }
};

// Funcția pentru a șterge un atribut
const deleteAttribute = async (req, res) => {
  const { categoryId, attributeId } = req.params;
  const { businessId } = req.user;

  try {
    // Aceeași verificare de securitate ca la update
    const attributeToDelete = await prisma.attribute.findFirst({
      where: {
        id: attributeId,
        categoryId: categoryId,
        category: {
          businessId: businessId,
        },
      },
    });

    if (!attributeToDelete) {
      return res
        .status(404)
        .json({ message: "Atributul nu a fost găsit sau nu aveți acces." });
    }

    // Prisma va preveni ștergerea dacă există valori asociate.
    // O strategie robustă ar fi să ștergem mai întâi valorile, dar pentru moment,
    // lăsăm eroarea default a bazei de date dacă există dependențe.
    await prisma.attribute.delete({
      where: { id: attributeId },
    });

    res.status(200).json({ message: "Atributul a fost șters." });
  } catch (error) {
    // Prindem eroarea în caz că atributul este folosit în anunțuri
    if (error.code === "P2003") {
      // Cod specific Prisma pentru foreign key constraint
      return res.status(409).json({
        message:
          "Acest atribut nu poate fi șters deoarece este folosit de unul sau mai multe anunțuri.",
      });
    }
    res
      .status(500)
      .json({ message: "Eroare la ștergerea atributului.", error });
  }
};

module.exports = {
  createAttribute,
  getAttributesForCategory,
  updateAttribute, // Adaugă funcția nouă
  deleteAttribute, // Adaugă funcția nouă
};
