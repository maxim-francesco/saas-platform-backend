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

// Funcție SECURIZATĂ pentru a prelua TOATE recenziile unui business
const getReviewsForAdmin = async (req, res) => {
  const { businessId } = req.user; // Preluat din token!

  try {
    const reviews = await prisma.review.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(reviews);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Eroare la preluarea recenziilor pentru admin." });
  }
};

// Funcție SECURIZATĂ pentru a aproba o recenzie
const approveReview = async (req, res) => {
  const { reviewId } = req.params;
  const { businessId } = req.user;

  try {
    // Verificăm că adminul modifică o recenzie care îi aparține
    const review = await prisma.review.findFirst({
      where: { id: reviewId, businessId },
    });
    if (!review) {
      return res
        .status(404)
        .json({ message: "Recenzia nu a fost găsită sau nu aveți acces." });
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
    res.status(200).json({ message: "Recenzia a fost aprobată cu succes." });
  } catch (error) {
    res.status(500).json({ message: "Eroare la aprobarea recenziei." });
  }
};

// Funcție SECURIZATĂ pentru a șterge o recenzie
const deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  const { businessId } = req.user;

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, businessId },
    });
    if (!review) {
      return res
        .status(404)
        .json({ message: "Recenzia nu a fost găsită sau nu aveți acces." });
    }

    await prisma.review.delete({
      where: { id: reviewId },
    });
    res.status(200).json({ message: "Recenzia a fost ștearsă cu succes." });
  } catch (error) {
    res.status(500).json({ message: "Eroare la ștergerea recenziei." });
  }
};

// Modifică `module.exports` la finalul fișierului pentru a include și noile funcții
module.exports = {
  submitReview,
  getApprovedReviews,
  getReviewsForAdmin, // Adaugă asta
  approveReview, // Adaugă asta
  deleteReview, // Adaugă asta
};
