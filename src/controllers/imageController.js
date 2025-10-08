// src/controllers/imageController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const axios = require("axios");

// src/controllers/imageController.js
const rotateImage = async (req, res) => {
  const { imageId } = req.params;
  const { businessId } = req.user;
  const { angle } = req.body;

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

    const bannerUrl = image.listing.business.bannerUrl;
    if (!bannerUrl)
      throw new Error("Acest business nu are un banner configurat.");

    const [imageResponse, bannerResponse] = await Promise.all([
      axios({ url: image.url, responseType: "arraybuffer" }),
      axios({ url: bannerUrl, responseType: "arraybuffer" }),
    ]);
    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    const bannerBuffer = Buffer.from(bannerResponse.data, "binary");

    // --- AICI ESTE MODIFICAREA CHEIE ---
    // 1. Obținem dimensiunile reale ale imaginii compuse
    const metadata = await sharp(imageBuffer).metadata();

    // 2. Calculăm dinamic înălțimea pozei (total - înălțimea banner-ului)
    const carPhotoHeight = metadata.height - 120;
    if (carPhotoHeight <= 0) {
      throw new Error("Imaginea este prea mică pentru a extrage poza mașinii.");
    }

    // 3. Extragem poza mașinii folosind dimensiunile dinamice
    const carPhotoBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: 0,
        width: metadata.width,
        height: carPhotoHeight,
      })
      .toBuffer();
    // --- SFÂRȘITUL MODIFICĂRII ---

    const rotatedCarPhoto = sharp(carPhotoBuffer).rotate(angle);
    const rotatedMetadata = await rotatedCarPhoto.metadata();

    const bannerResizedBuffer = await sharp(bannerBuffer)
      .resize({ width: rotatedMetadata.width, height: 120, fit: "fill" })
      .toBuffer();

    const finalBuffer = await sharp({
      create: {
        width: rotatedMetadata.width,
        height: rotatedMetadata.height + 120,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        { input: await rotatedCarPhoto.toBuffer(), gravity: "north" },
        { input: bannerResizedBuffer, gravity: "south" },
      ])
      .jpeg()
      .toBuffer();

    const urlParts = image.url.split("/");
    const publicIdWithExtension = urlParts
      .slice(urlParts.indexOf("saas-platform"))
      .join("/");
    const publicId = publicIdWithExtension.substring(
      0,
      publicIdWithExtension.lastIndexOf(".")
    );

    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, invalidate: true },
      (error, result) => {
        if (error)
          return res
            .status(500)
            .json({ message: "Eroare la re-upload Cloudinary." });
        res
          .status(200)
          .json({
            message: "Imaginea a fost rotită cu succes.",
            url: result.secure_url,
          });
      }
    );
    uploadStream.end(finalBuffer);
  } catch (error) {
    console.error("Image rotation error:", error);
    res.status(500).json({ message: "Eroare internă la rotirea imaginii." });
  }
};

module.exports = { rotateImage };
