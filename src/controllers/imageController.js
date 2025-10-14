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

    if (!image) {
      return res.status(404).json({ message: "Imaginea nu a fost găsită." });
    }
    console.log(`[DEBUG] Imaginea găsită. URL: ${image.url}`);

    const imageResponse = await axios({
      url: image.url,
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    console.log("[DEBUG] Imaginea a fost descărcată.");

    let finalBuffer;
    const bannerUrl = image.listing.business.bannerUrl;
    const BANNER_HEIGHT = 120;

    if (bannerUrl) {
      console.log(
        "[DEBUG] Se procesează imaginea CU banner folosind logica de decupare..."
      );
      const metadata = await sharp(imageBuffer).metadata();
      const photoHeight = metadata.height - BANNER_HEIGHT;

      if (photoHeight <= 0) {
        throw new Error("Imaginea este prea mică pentru a decupa banner-ul.");
      }

      const photoOnlyBuffer = await sharp(imageBuffer)
        .extract({
          left: 0,
          top: 0,
          width: metadata.width,
          height: photoHeight,
        })
        .toBuffer();
      console.log(`[DEBUG] Fotografia a fost decupată (fără banner-ul vechi).`);

      const rotatedPhoto = sharp(photoOnlyBuffer).rotate().rotate(angle);
      const rotatedPhotoBuffer = await rotatedPhoto.toBuffer();
      const rotatedMetadata = await sharp(rotatedPhotoBuffer).metadata();
      console.log(
        `[DEBUG] Fotografia decupată a fost rotită. Dimensiuni noi: ${rotatedMetadata.width}x${rotatedMetadata.height}`
      );

      const bannerResponse = await axios({
        url: bannerUrl,
        responseType: "arraybuffer",
      });
      const bannerTemplateBuffer = Buffer.from(bannerResponse.data, "binary");
      const resizedBannerBuffer = await sharp(bannerTemplateBuffer)
        .resize({
          width: rotatedMetadata.width,
          height: BANNER_HEIGHT,
          fit: "fill",
        })
        .toBuffer();
      console.log(
        `[DEBUG] Un banner nou a fost pregătit la lățimea de ${rotatedMetadata.width}px.`
      );

      // --- ✅ BLOC MODIFICAT: Re-compunere pe o pânză goală ---
      console.log("[DEBUG] Se re-compune imaginea finală pe o pânză nouă...");
      finalBuffer = await sharp({
        create: {
          width: rotatedMetadata.width,
          height: rotatedMetadata.height + BANNER_HEIGHT,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([
          { input: rotatedPhotoBuffer, gravity: "north" },
          { input: resizedBannerBuffer, gravity: "south" },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log("[DEBUG] Procesarea CU banner a fost finalizată cu succes.");
      // --- SFÂRȘIT BLOC MODIFICAT ---
    } else {
      console.log("[DEBUG] Se procesează imaginea FĂRĂ banner...");
      finalBuffer = await sharp(imageBuffer)
        .rotate()
        .rotate(angle)
        .resize({ width: 800, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      console.log("[DEBUG] Procesarea FĂRĂ banner a fost finalizată.");
    }

    const publicIdMatch = image.url.match(/upload\/(?:v\d+\/)?(.+?)\./);
    if (!publicIdMatch || !publicIdMatch[1]) {
      throw new Error("Nu s-a putut extrage public_id din URL-ul imaginii.");
    }
    const publicId = publicIdMatch[1];

    console.log("[DEBUG] Se re-încarcă imaginea procesată pe Cloudinary...");
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, invalidate: true },
      (error, result) => {
        if (error) {
          console.error("[DEBUG] EROARE la re-upload Cloudinary:", error);
          return res
            .status(500)
            .json({ message: "Eroare la re-upload Cloudinary." });
        }
        console.log("[DEBUG] Imaginea a fost re-încărcată cu succes!");
        res.status(200).json({
          message: "Imaginea a fost rotită cu succes.",
          url: result.secure_url,
        });
      }
    );
    uploadStream.end(finalBuffer);
  } catch (error) {
    console.error(
      "[DEBUG] EROARE GENERALĂ în blocul try-catch:",
      error.message
    );
    res.status(500).json({
      message: "Eroare internă la rotirea imaginii.",
      error: error.message,
    });
  }
};

module.exports = { rotateImage };
