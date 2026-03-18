// src/routes/ogRoutes.js
const express = require("express");
const prisma = require("../config/prismaClient");
const router = express.Router();

const SPA_BASE_URL = process.env.SPA_BASE_URL || "https://necris.ro";

router.get("/property/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: {
          select: { url: true },
          orderBy: { order: "asc" },
          take: 1,
        },
        business: {
          select: { name: true },
        },
      },
    });

    if (!listing) {
      return res.redirect(302, SPA_BASE_URL);
    }

    const spaUrl = `${SPA_BASE_URL}/property/${listing.id}`;
    const ogUrl = `https://saas-platform-backend.onrender.com/og/property/${listing.id}`;
    const ogImage = listing.images[0]?.url || `${SPA_BASE_URL}/og-default.jpg`;
    const ogTitle = listing.title;
    const priceLabel = listing.price
      ? ` • ${listing.price.toLocaleString("ro-RO")} €`
      : "";
    const ogDescription =
      (listing.description
        ? listing.description.slice(0, 160)
        : `Proprietate disponibilă la ${listing.business?.name || "Necris Imobiliare"}`) +
      priceLabel;

    const esc = (str) =>
      String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const html = `<!DOCTYPE html>
<html lang="ro" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(ogTitle)}</title>

  <!-- Open Graph (Facebook, WhatsApp, Telegram, LinkedIn) -->
  <meta property="og:type"         content="website" />
  <meta property="og:url"          content="${esc(ogUrl)}" />
  <meta property="og:title"        content="${esc(ogTitle)}" />
  <meta property="og:description"  content="${esc(ogDescription)}" />
  <meta property="og:image"        content="${esc(ogImage)}" />
  <meta property="og:image:type"   content="image/jpeg" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale"       content="ro_RO" />
  <meta property="og:site_name"    content="${esc(listing.business?.name || "Necris Imobiliare")}" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDescription)}" />
  <meta name="twitter:image"       content="${esc(ogImage)}" />
</head>
<body>
  <p>Se încarcă... <a href="${esc(spaUrl)}">Click aici dacă nu ești redirecționat automat.</a></p>

  <!-- Redirect JS instant pentru browsere normale -->
  <script>
    window.location.replace("${spaUrl.replace(/"/g, '\\"')}");
  </script>
</body>
</html>`;

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    console.error("[OG] Eroare la generarea preview-ului:", error);
    return res.redirect(302, SPA_BASE_URL);
  }
});

module.exports = router;