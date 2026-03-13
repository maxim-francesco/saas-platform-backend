// src/index.js
const helmet = require("helmet");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const listingRoutes = require("./routes/listingRoutes");
const publicRoutes = require("./routes/publicRoutes");
const messageRoutes = require("./routes/messageRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const businessRoutes = require("./routes/businessRoutes");
const imageRoutes = require("./routes/imageRoutes");
const attributeGroupRoutes = require("./routes/attributeGroupRoutes"); // Asigură-te că este importat
const attributesRootRoutes = require("./routes/attributesRootRoutes");
const publicReviewRoutes = require("./routes/publicReviewRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const viewRoutes = require("./routes/viewRoutes");
const reportsRoutes = require("./routes/reportsRoutes"); // <-- ADAUGĂ ASTA
const superAdminRoutes = require("./routes/superAdminRoutes");
const ogRoutes = require("./routes/ogRoutes");



const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Verifică exact SAU versiunea fără/cu www
    const normalizedOrigin = origin.replace("://www.", "://");
    const isAllowed = allowedOrigins.some((allowed) => {
      const normalizedAllowed = allowed.replace("://www.", "://");
      return normalizedOrigin === normalizedAllowed;
    });

    if (isAllowed) {
      return callback(null, true);
    }

    console.log(`[CORS] Blocat origin: ${origin}`);
    return callback(new Error("Blocat de CORS."));
  },
  credentials: true,
}));

app.use(helmet());

// --- CONFIGURARE LIMITĂ DATE ---
// Video-urile sunt mari, deci avem nevoie de limite ridicate pentru body-ul cererii
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// --- ✅ PLASA DE SIGURANȚĂ #1: LOGGER PENTRU TOATE CERERILE ---
// Acest middleware se va executa primul pentru ORICE cerere și ne va confirma că a ajuns la server.
app.use((req, res, next) => {
  console.log(`[GLOBAL LOG] Primit: ${req.method} ${req.originalUrl}`);
  next(); // Trimite cererea mai departe
});
// --- SFÂRȘIT BLOC NOU ---

app.get("/", (req, res) => {
  res.json({ message: "Bun venit pe API-ul platformei SaaS!" });
});

// Folosește rutele
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/attribute-groups", attributeGroupRoutes);
app.use("/api/attributes", attributesRootRoutes); // Adaugă această linie
app.use("/api/public/reviews", publicReviewRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/views", viewRoutes);
app.use("/api/reports", reportsRoutes); // <-- ADAUGĂ ASTA
app.use("/api/super-admin", superAdminRoutes);
app.use("/og", ogRoutes);


// --- ✅ PLASA DE SIGURANȚĂ #2: GESTIONAR GLOBAL DE ERORI ---
// Acest middleware se va executa la final DOAR dacă o eroare a fost aruncată ("thrown")
// de oriunde din cod (inclusiv din middleware-uri) și nu a fost prinsă de un `try...catch`.
app.use((err, req, res, next) => {
  console.error("[GLOBAL ERROR HANDLER] A fost prinsă o eroare necunoscută!");
  console.error(err); // Logăm întreaga eroare, cu tot cu stack trace

  // Trimitem un răspuns de eroare generic pentru a nu expune detalii
  res.status(500).json({
    message: "A apărut o eroare neașteptată pe server.",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});
// --- SFÂRȘIT BLOC NOU ---

app.listen(PORT, () => {
  console.log(`🚀 Serverul rulează la adresa http://localhost:${PORT}`);
});
