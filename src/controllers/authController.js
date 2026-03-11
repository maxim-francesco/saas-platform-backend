// src/controllers/authController.js
const prisma = require("../config/prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Funcția de înregistrare a unui nou Business și a primului său Admin
const register = async (req, res) => {
  const { businessName, email, password } = req.body;

  // 1. Validare simplă
  if (!businessName || !email || !password) {
    return res
      .status(400)
      .json({ message: "Toate câmpurile sunt obligatorii." });
  }

  try {
    // 2. Verificăm dacă există deja un user cu acest email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Emailul este deja folosit." });
    }

    // 3. Tocăm (hash) parola înainte de a o salva
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Folosim o tranzacție Prisma pentru a ne asigura că ambele operațiuni
    // (creare Business și creare User) au succes sau eșuează împreună.
    const result = await prisma.$transaction(async (prisma) => {
      const newBusiness = await prisma.business.create({
        data: {
          name: businessName,
        },
      });

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: "ADMIN", // Primul user este mereu Admin
          businessId: newBusiness.id,
        },
      });

      // Excludem parola din obiectul returnat
      delete newUser.password;
      return { newUser, newBusiness };
    });

    res.status(201).json({
      message: "Business și admin înregistrați cu succes!",
      user: result.newUser,
      business: result.newBusiness,
    });
  } catch (error) {
    console.error("Eroare la înregistrare:", error);
    res.status(500).json({ message: "Ceva nu a funcționat corect." });
  }
};

// Funcția de login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Căutăm user-ul în baza de date
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Mesaj generic pentru securitate
      return res.status(401).json({ message: "Credențiale invalide." });
    }

    // 2. Comparăm parola primită cu hash-ul din baza de date
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: "Credențiale invalide." });
    }

    // 3. Dacă totul e corect, creăm token-ul JWT
    const payload = {
      userId: user.id,
      businessId: user.businessId,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d", // Token-ul va expira în 7 zile
    });

    res.status(200).json({
      message: "Autentificare reușită!",
      token: token,
    });
  } catch (error) {
    console.error("Eroare la login:", error);
    res.status(500).json({ message: "Ceva nu a funcționat corect." });
  }
};

module.exports = { register, login };
