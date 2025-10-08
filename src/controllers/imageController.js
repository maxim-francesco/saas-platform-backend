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
    console.log(
      `[DEBUG] Start rotire pentru imaginea ${imageId} cu unghiul ${angle}`
    );

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

    const initialMetadata = await sharp(imageBuffer).metadata();
    console.log(
      `[DEBUG] Dimensiuni imagine originală compusă: ${initialMetadata.width}x${initialMetadata.height}`
    );

    const carPhotoHeight = initialMetadata.height - 120;
    if (carPhotoHeight <= 0) throw new Error("Imaginea este prea mică.");

    const carPhotoBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: 0,
        width: initialMetadata.width,
        height: carPhotoHeight,
      })
      .toBuffer();
    const carPhotoMetadata = await sharp(carPhotoBuffer).metadata();
    console.log(
      `[DEBUG] Dimensiuni poză mașină extrasă: ${carPhotoMetadata.width}x${carPhotoMetadata.height}`
    );

    const rotatedCarPhotoBuffer = await sharp(carPhotoBuffer)
      .rotate(angle)
      .toBuffer();
    const rotatedMetadata = await sharp(rotatedCarPhotoBuffer).metadata();
    console.log(
      `[DEBUG] Dimensiuni poză mașină rotită: ${rotatedMetadata.width}x${rotatedMetadata.height}`
    );

    const bannerResizedBuffer = await sharp(bannerBuffer)
      .resize({ width: rotatedMetadata.width, height: 120, fit: "fill" })
      .toBuffer();
    const bannerMetadata = await sharp(bannerResizedBuffer).metadata();
    console.log(
      `[DEBUG] Dimensiuni banner redimensionat: ${bannerMetadata.width}x${bannerMetadata.height}`
    );

    console.log(
      `[DEBUG] Se creează pânza finală de ${rotatedMetadata.width}x${
        rotatedMetadata.height + 120
      }`
    );
    const finalBuffer = await sharp({
      create: {
        width: rotatedMetadata.width,
        height: rotatedMetadata.height + 120,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        { input: rotatedCarPhotoBuffer, gravity: "north" },
        { input: bannerResizedBuffer, gravity: "south" },
      ])
      .jpeg()
      .toBuffer();
    console.log("[DEBUG] Imaginea finală a fost compusă cu succes.");

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
        if (error) {
          console.error("[DEBUG] Eroare la re-upload Cloudinary:", error);
          return res
            .status(500)
            .json({ message: "Eroare la re-upload Cloudinary." });
        }
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
    console.error("Image rotation error:", error.message);
    res
      .status(500)
      .json({
        message: "Eroare internă la rotirea imaginii.",
        error: error.message,
      });
  }
};

module.exports = { rotateImage };
