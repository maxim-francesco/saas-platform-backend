// src/controllers/imageController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const axios = require("axios");

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

    const imageResponse = await axios({
      url: image.url,
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data, "binary");

    let finalBuffer;
    const bannerUrl = image.listing.business.bannerUrl;

    if (bannerUrl) {
      // CAZUL 1: Business-ul ARE banner
      const bannerResponse = await axios({
        url: bannerUrl,
        responseType: "arraybuffer",
      });
      const bannerBuffer = Buffer.from(bannerResponse.data, "binary");

      const metadata = await sharp(imageBuffer).metadata();
      const carPhotoHeight = metadata.height - 120;
      if (carPhotoHeight <= 0) throw new Error("Imaginea este prea mică.");

      const carPhotoBuffer = await sharp(imageBuffer)
        .extract({
          left: 0,
          top: 0,
          width: metadata.width,
          height: carPhotoHeight,
        })
        .toBuffer();
      const rotatedCarPhoto = sharp(carPhotoBuffer).rotate(angle);
      const rotatedMetadata = await rotatedCarPhoto.metadata();
      const bannerResizedBuffer = await sharp(bannerBuffer)
        .resize({ width: rotatedMetadata.width, height: 120, fit: "fill" })
        .toBuffer();

      finalBuffer = await sharp({
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
    } else {
      // CAZUL 2: Business-ul NU are banner
      finalBuffer = await sharp(imageBuffer)
        .rotate()
        .rotate(angle)
        .resize({ width: 800, height: 600, fit: "cover" })
        .jpeg()
        .toBuffer();
    }

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
        res.status(200).json({
          message: "Imaginea a fost rotită cu succes.",
          url: result.secure_url,
        });
      }
    );
    uploadStream.end(finalBuffer);
  } catch (error) {
    console.error("Image rotation error:", error.message);
    res.status(500).json({
      message: "Eroare internă la rotirea imaginii.",
      error: error.message,
    });
  }
};

module.exports = { rotateImage };
