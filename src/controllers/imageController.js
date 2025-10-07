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
    // 1. Verificarea de securitate
    const image = await prisma.listingImage.findFirst({
      where: { id: imageId, listing: { businessId: businessId } },
      include: { listing: { include: { business: true } } }, // Includem și business-ul pentru a avea acces la bannerUrl
    });
    if (!image)
      return res.status(404).json({ message: "Imaginea nu a fost găsită." });

    const bannerUrl = image.listing.business.bannerUrl;
    if (!bannerUrl)
      throw new Error("Acest business nu are un banner configurat.");

    // 2. Descarcă imaginea COMPUSĂ (cu banner) și banner-ul
    const [imageResponse, bannerResponse] = await Promise.all([
      axios({ url: image.url, responseType: "arraybuffer" }),
      axios({ url: bannerUrl, responseType: "arraybuffer" }),
    ]);
    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    const bannerBuffer = Buffer.from(bannerResponse.data, "binary");

    // 3. EXTRAGEM doar poza mașinii, fără banner-ul de jos
    // Presupunem că poza are 800x600 și banner-ul 800x120
    const carPhotoBuffer = await sharp(imageBuffer)
      .extract({ left: 0, top: 0, width: 800, height: 600 })
      .toBuffer();

    // 4. ROTIM DOAR poza mașinii
    const rotatedCarPhoto = sharp(carPhotoBuffer).rotate(angle);

    // 5. Re-pregătim banner-ul
    const bannerImage = sharp(bannerBuffer).resize({
      width: 800,
      height: 120,
      fit: "fill",
    });
    const bannerResizedBuffer = await bannerImage.toBuffer();

    // 6. RECOMPUNEM imaginea finală: poza rotită + banner-ul original
    const finalBuffer = await rotatedCarPhoto
      .extend({ bottom: 120, background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .composite([{ input: bannerResizedBuffer, gravity: "south" }])
      .jpeg()
      .toBuffer();

    // 7. Suprascriem imaginea pe Cloudinary
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
    console.error("Image rotation error:", error);
    res.status(500).json({ message: "Eroare internă la rotirea imaginii." });
  }
};

module.exports = { rotateImage };
