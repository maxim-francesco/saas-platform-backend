// src/index.js
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const authRoutes = require("./routes/authRoutes"); // Importă rutele
const categoryRoutes = require("./routes/categoryRoutes");
const listingRoutes = require("./routes/listingRoutes");
const publicRoutes = require("./routes/publicRoutes");
const messageRoutes = require("./routes/messageRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const businessRoutes = require("./routes/businessRoutes");
const imageRoutes = require("./routes/imageRoutes");
const attributeGroupRoutes = require("./routes/attributeGroupRoutes"); // Importă rutele noi

const app = express();
const PORT = process.env.PORT || 3000;

// // 2. Configurează CORS pentru a permite cereri DOAR de la adresa frontend-ului tău
// const corsOptions = {
//   origin:
//     "https://6000-firebase-studio-1758560203835.cluster-axf5tvtfjjfekvhwxwkkkzsk2y.cloudworkstations.dev",
// };
// app.use(cors(corsOptions));

app.use(cors());

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
app.use("/api/messages", messageRoutes); // Adaugă rutele de mesaje
app.use("/api/dashboard", dashboardRoutes); // Adaugă rutele de dashboard
app.use("/api/business", businessRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/attribute-groups", attributeGroupRoutes); // Adaugă linia asta

app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează la adresa http://localhost:${PORT}`);
});
