// src/controllers/attributeController.js
const prisma = require("../config/prismaClient");

// Funcția pentru a crea un atribut nou pentru o categorie specifică
const createAttribute = async (req, res) => {
  const { categoryId } = req.params; // Preluăm ID-ul categoriei din URL
  const { name, type } = req.body; // Preluăm numele și tipul atributului din body
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
      },
    });

    res.status(201).json(newAttribute);
  } catch (error) {
    // Gestionăm cazul în care un atribut cu același nume există deja pt. categorie etc.
    res.status(500).json({ message: "Eroare la crearea atributului.", error });
  }
};

// Funcția pentru a lista toate atributele unei categorii
const getAttributesForCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { businessId } = req.user;

  try {
    // Facem aceeași verificare de securitate și aici
    const category = await prisma.category.findFirst({
      where: { id: categoryId, businessId: businessId },
    });

    if (!category) {
      return res.status(404).json({
        message: "Categoria nu a fost găsită sau nu aveți acces la ea.",
      });
    }

    const attributes = await prisma.attribute.findMany({
      where: {
        categoryId: categoryId,
      },
    });
    res.status(200).json(attributes);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Eroare la preluarea atributelor.", error });
  }
};

module.exports = { createAttribute, getAttributesForCategory };
