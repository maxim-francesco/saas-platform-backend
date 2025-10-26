// src/controllers/reviewController.js
const prisma = require("../config/prismaClient");

// Funcție PUBLICĂ pentru a trimite o recenzie nouă
const submitReview = async (req, res) => {
  const { businessId, name, rating, text } = req.body;

  if (!businessId || !name || !rating || !text) {
    return res
      .status(400)
      .json({ message: "Toate câmpurile sunt obligatorii." });
  }

  const numericRating = parseInt(rating, 10);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res
      .status(400)
      .json({ message: "Rating-ul trebuie să fie un număr între 1 și 5." });
  }

  try {
    const newReview = await prisma.review.create({
      data: {
        name,
        rating: numericRating,
        text,
        businessId,
        isApproved: false, // O recenzie nouă nu este niciodată aprobată automat
      },
    });
    res.status(201).json({
      message: "Recenzia a fost trimisă cu succes și așteaptă aprobarea!",
    });
  } catch (error) {
    console.error("Eroare la trimiterea recenziei:", error);
    res.status(500).json({ message: "Eroare la trimiterea recenziei." });
  }
};

// Funcție PUBLICĂ pentru a afișa recenziile aprobate
const getApprovedReviews = async (req, res) => {
  const { businessId } = req.query;

  if (!businessId) {
    return res
      .status(400)
      .json({ message: "ID-ul afacerii este obligatoriu." });
  }

  try {
    const reviews = await prisma.review.findMany({
      where: {
        businessId: businessId,
        isApproved: true, // Afișăm DOAR recenziile aprobate
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Eroare la preluarea recenziilor:", error);
    res.status(500).json({ message: "Eroare la preluarea recenziilor." });
  }
};

module.exports = {
  submitReview,
  getApprovedReviews,
};
