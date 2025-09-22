// src/index.js
const express = require("express");
require("dotenv").config();
const authRoutes = require("./routes/authRoutes"); // Importă rutele
const categoryRoutes = require("./routes/categoryRoutes");
const listingRoutes = require("./routes/listingRoutes");
const publicRoutes = require("./routes/publicRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pentru a putea parsa body-ul request-urilor JSON
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Bun venit pe API-ul platformei SaaS!" });
});

// Folosește rutele de autentificare sub prefixul /api/auth
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/public", publicRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează la adresa http://localhost:${PORT}`);
});
