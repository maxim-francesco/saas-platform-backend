// src/controllers/categoryController.js
const prisma = require("../config/prismaClient");

// Funcția pentru a crea o nouă categorie
const createCategory = async (req, res) => {
  const { name } = req.body;
  const { businessId } = req.user; // Preluat din token via middleware!

  if (!name) {
    return res
      .status(400)
      .json({ message: "Numele categoriei este obligatoriu." });
  }

  try {
    const newCategory = await prisma.category.create({
      data: {
        name,
        businessId, // Asigurăm legătura cu business-ul corect
      },
    });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: "Eroare la crearea categoriei.", error });
  }
};

// Funcția pentru a lista toate categoriile unui business
const getCategories = async (req, res) => {
  const { businessId } = req.user; // Preluat din token via middleware!

  try {
    const categories = await prisma.category.findMany({
      where: {
        businessId: businessId, // Filtru esențial pentru multi-tenancy!
      },
    });
    res.status(200).json(categories);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Eroare la preluarea categoriilor.", error });
  }
};

const updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;
  const { businessId } = req.user;

  if (!name) {
    return res
      .status(400)
      .json({ message: "Numele categoriei este obligatoriu." });
  }

  try {
    const updatedCategory = await prisma.category.updateMany({
      where: {
        id: categoryId,
        businessId: businessId, // Securitate: asigură că user-ul modifică doar o categorie proprie
      },
      data: { name },
    });

    if (updatedCategory.count === 0) {
      return res.status(404).json({
        message: "Categoria nu a fost găsită sau nu aveți acces la ea.",
      });
    }

    res.status(200).json({ message: "Categoria a fost actualizată." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Eroare la actualizarea categoriei.", error });
  }
};

// Funcția pentru a șterge o categorie
const deleteCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { businessId } = req.user;

  try {
    // Pentru a șterge o categorie, trebuie să ștergem mai întâi toate datele asociate.
    // Folosim o tranzacție pentru a ne asigura că totul se execută corect.
    await prisma.$transaction(async (prisma) => {
      // Verificăm dacă categoria există și aparține business-ului
      const category = await prisma.category.findFirst({
        where: { id: categoryId, businessId },
        include: { listings: true },
      });

      if (!category) {
        throw new Error("Categoria nu a fost găsită sau nu aveți acces la ea.");
      }

      // Ștergem valorile atributelor pentru toate anunțurile din categorie
      const listingIds = category.listings.map((l) => l.id);
      if (listingIds.length > 0) {
        await prisma.attributeValue.deleteMany({
          where: { listingId: { in: listingIds } },
        });
      }

      // Ștergem anunțurile din categorie
      await prisma.listing.deleteMany({ where: { categoryId } });

      // Ștergem atributele definite pentru categorie
      await prisma.attribute.deleteMany({ where: { categoryId } });

      // În final, ștergem categoria
      await prisma.category.delete({ where: { id: categoryId } });
    });

    res
      .status(200)
      .json({ message: "Categoria și toate datele asociate au fost șterse." });
  } catch (error) {
    res
      .status(404)
      .json({ message: error.message || "Eroare la ștergerea categoriei." });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
