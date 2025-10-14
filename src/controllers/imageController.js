// src/controllers/imageController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const axios = require("axios");

const rotateImage = async (req, res) => {
  console.log(
    `[DEBUG] Start rotateImage pentru imaginea cu ID: ${req.params.imageId}`
  );
  const { imageId } = req.params;
  const { businessId } = req.user;
  const { angle } = req.body;
  console.log(`[DEBUG] Angle primit: ${angle}, Business ID: ${businessId}`);

  if (angle === undefined || angle % 90 !== 0) {
    console.error("[DEBUG] Eroare: Unghiul de rotație este invalid.");
    return res
      .status(400)
      .json({ message: "Unghiul de rotație este invalid." });
  }

  try {
    console.log("[DEBUG] Pas 1: Se caută imaginea în baza de date...");
    const image = await prisma.listingImage.findFirst({
      where: { id: imageId, listing: { businessId: businessId } },
      include: { listing: { include: { business: true } } },
    });

    if (!image) {
      console.error("[DEBUG] Eroare: Imaginea nu a fost găsită în DB.");
      return res.status(404).json({ message: "Imaginea nu a fost găsită." });
    }
    console.log(`[DEBUG] Pas 2: Imaginea a fost găsită. URL: ${image.url}`);

    console.log(
      "[DEBUG] Pas 3: Se descarcă imaginea de la URL-ul de mai sus..."
    );
    const imageResponse = await axios({
      url: image.url,
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    console.log(
      "[DEBUG] Pas 4: Imaginea a fost descărcată cu succes în buffer."
    );

    let finalBuffer;
    const bannerUrl = image.listing.business.bannerUrl;

    // --- BLOC MODIFICAT PENTRU PROCESAREA CU BANNER ---
    if (bannerUrl) {
      console.log(
        "[DEBUG] Pas 5: Se procesează imaginea CU banner (LOGICĂ NOUĂ)..."
      );

      // 1. Descarcă banner-ul
      const bannerResponse = await axios({
        url: bannerUrl,
        responseType: "arraybuffer",
      });
      const bannerBuffer = Buffer.from(bannerResponse.data, "binary");

      // 2. Rotește imaginea principală
      const rotatedImage = await sharp(imageBuffer)
        .rotate()
        .rotate(angle)
        .toBuffer();
      const metadata = await sharp(rotatedImage).metadata();

      // 3. Redimensionează banner-ul să se potrivească cu lățimea imaginii rotite
      const resizedBanner = await sharp(bannerBuffer)
        .resize({ width: metadata.width, height: 120, fit: "fill" })
        .toBuffer();

      // 4. Compune imaginea rotită cu banner-ul dedesubt
      finalBuffer = await sharp(rotatedImage)
        .composite([{ input: resizedBanner, gravity: "south" }])
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log("[DEBUG] Pas 6: Procesarea CU banner a fost finalizată.");
    } else {
      console.log(
        "[DEBUG] Pas 5: Se procesează imaginea FĂRĂ banner folosind Sharp..."
      );
      finalBuffer = await sharp(imageBuffer)
        .rotate()
        .rotate(angle)
        .resize({ width: 800, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      console.log("[DEBUG] Pas 6: Procesarea FĂRĂ banner a fost finalizată.");
    }
    // --- SFÂRȘIT BLOC MODIFICAT ---

    const publicIdMatch = image.url.match(/upload\/(?:v\d+\/)?(.+?)\./);
    if (!publicIdMatch || !publicIdMatch[1]) {
      throw new Error("Nu s-a putut extrage public_id din URL-ul imaginii.");
    }
    const publicId = publicIdMatch[1];
    console.log(`[DEBUG] Pas 7: public_id extras cu succes: ${publicId}`);

    console.log(
      "[DEBUG] Pas 8: Se re-încarcă imaginea procesată pe Cloudinary..."
    );
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, invalidate: true },
      (error, result) => {
        if (error) {
          console.error("[DEBUG] EROARE la re-upload Cloudinary:", error);
          return res
            .status(500)
            .json({ message: "Eroare la re-upload Cloudinary." });
        }
        console.log("[DEBUG] Pas 9: Imaginea a fost re-încărcată cu succes!");
        res.status(200).json({
          message: "Imaginea a fost rotită cu succes.",
          url: result.secure_url,
        });
      }
    );
    uploadStream.end(finalBuffer);
  } catch (error) {
    console.error("[DEBUG] EROARE GENERALĂ în blocul try-catch:", error);
    res.status(500).json({
      message: "Eroare internă la rotirea imaginii.",
      error: error.message,
    });
  }
};

module.exports = { rotateImage };
