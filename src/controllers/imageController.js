// src/controllers/imageController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const axios = require("axios");

const rotateImage = async (req, res) => {
  const { imageId } = req.params;
  const { businessId } = req.user;
  const { angle } = req.body;

  console.log(
    `[DEBUG] Start rotire pentru imaginea ${imageId} cu unghiul ${angle}`
  );

  if (angle === undefined || angle % 90 !== 0) {
    return res
      .status(400)
      .json({ message: "Unghiul de rotație este invalid." });
  }

  try {
    const image = await prisma.listingImage.findFirst({
      where: { id: imageId, listing: { businessId: businessId } },
      include: { listing: { include: { business: true } } },
    });
    if (!image)
      return res.status(404).json({ message: "Imaginea nu a fost găsită." });

    console.log(
      "[DEBUG] Imagine găsită în DB. Se descarcă imaginea și banner-ul..."
    );
    const bannerUrl = image.listing.business.bannerUrl;
    if (!bannerUrl)
      throw new Error("Acest business nu are un banner configurat.");

    const [imageResponse, bannerResponse] = await Promise.all([
      axios({ url: image.url, responseType: "arraybuffer" }),
      axios({ url: bannerUrl, responseType: "arraybuffer" }),
    ]);
    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    const bannerBuffer = Buffer.from(bannerResponse.data, "binary");
    console.log("[DEBUG] Descărcare finalizată.");

    console.log("[DEBUG] Se extrage poza mașinii...");
    const carPhotoBuffer = await sharp(imageBuffer)
      .extract({ left: 0, top: 0, width: 800, height: 600 })
      .toBuffer();

    console.log("[DEBUG] Se rotește poza extrasă...");
    const rotatedCarPhoto = sharp(carPhotoBuffer).rotate(angle);

    const bannerImage = sharp(bannerBuffer).resize({
      width: 800,
      height: 120,
      fit: "fill",
    });
    const bannerResizedBuffer = await bannerImage.toBuffer();

    console.log("[DEBUG] Se recompune imaginea finală...");
    const finalBuffer = await rotatedCarPhoto
      .extend({ bottom: 120, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .composite([{ input: bannerResizedBuffer, gravity: "south" }])
      .jpeg()
      .toBuffer();
    console.log("[DEBUG] Imaginea finală a fost creată în memorie.");

    const urlParts = image.url.split("/");
    const publicIdWithExtension = urlParts
      .slice(urlParts.indexOf("saas-platform"))
      .join("/");
    const publicId = publicIdWithExtension.substring(
      0,
      publicIdWithExtension.lastIndexOf(".")
    );
    console.log(`[DEBUG] Se încarcă pe Cloudinary cu public_id: ${publicId}`);

    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, invalidate: true },
      (error, result) => {
        if (error) {
          console.error("[DEBUG] EROARE la upload Cloudinary:", error);
          return res
            .status(500)
            .json({ message: "Eroare la re-upload Cloudinary." });
        }
        console.log(
          "[DEBUG] Upload Cloudinary finalizat cu succes:",
          result.secure_url
        );
        res.status(200).json({
          message: "Imaginea a fost rotită cu succes.",
          url: result.secure_url,
        });
      }
    );
    uploadStream.end(finalBuffer);
  } catch (error) {
    console.error("[DEBUG] Eroare majoră în funcția rotateImage:", error);
    res.status(500).json({ message: "Eroare internă la rotirea imaginii." });
  }
};

const updateImageOrder = async (req, res) => {
  const { listingId } = req.params;
  const { imageIds } = req.body;
  const { businessId } = req.user;

  // --- LOG-URI PENTRU DEBUG ---
  console.log(
    `[DEBUG] Primit cerere de reordonare pentru listingId: ${listingId}`
  );
  console.log(`[DEBUG] Body-ul cererii (req.body):`, req.body);
  console.log(`[DEBUG] Array-ul de ID-uri extras (imageIds):`, imageIds);
  // --- SFÂRȘIT LOG-URI ---

  if (!Array.isArray(imageIds)) {
    console.log("[DEBUG] EROARE: imageIds nu este un array.");
    return res
      .status(400)
      .json({ message: "Este necesar un array de ID-uri." });
  }

  try {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, businessId },
    });
    if (!listing) {
      console.log(
        "[DEBUG] EROARE: Anunțul nu a fost găsit pentru acest business."
      );
      return res.status(404).json({ message: "Anunț negăsit." });
    }

    console.log(
      `[DEBUG] Se pregătesc ${imageIds.length} operațiuni de update.`
    );

    const updatePromises = imageIds.map((imageId, index) => {
      console.log(
        ` -> Pregătire update: imaginea cu ID ${imageId} va primi order = ${index}`
      );
      return prisma.listingImage.update({
        where: { id: imageId },
        data: { order: index },
      });
    });

    await prisma.$transaction(updatePromises);

    console.log("[DEBUG] Tranzacția de update a fost finalizată cu succes.");
    res.status(200).json({ message: "Ordinea imaginilor a fost actualizată." });
  } catch (error) {
    console.error("[DEBUG] EROARE MAJORĂ în updateImageOrder:", error);
    res
      .status(500)
      .json({ message: "Eroare la actualizarea ordinii imaginilor." });
  }
};

module.exports = { rotateImage, updateImageOrder };
