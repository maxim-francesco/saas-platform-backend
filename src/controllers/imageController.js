// src/controllers/imageController.js
const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");
const axios = require("axios");

// Funcția pentru a roti o imagine existentă
const rotateImage = async (req, res) => {
  const { imageId } = req.params;
  const { businessId } = req.user;
  const { angle } = req.body; // Unghiul de rotație (ex: 90, 180, 270)

  if (angle === undefined || angle % 90 !== 0) {
    return res
      .status(400)
      .json({ message: "Unghiul de rotație este invalid." });
  }

  try {
    // 1. Verificare de securitate: imaginea aparține unui anunț al business-ului?
    const image = await prisma.listingImage.findFirst({
      where: { id: imageId, listing: { businessId: businessId } },
    });
    if (!image)
      return res.status(404).json({ message: "Imaginea nu a fost găsită." });

    // 2. Descarcă imaginea existentă din Cloudinary
    const response = await axios({
      url: image.url,
      responseType: "arraybuffer",
    });
    const imageBuffer = Buffer.from(response.data, "binary");

    // 3. Aplică rotația cu Sharp
    const rotatedBuffer = await sharp(imageBuffer).rotate(angle).toBuffer();

    // 4. Extrage public_id din URL-ul vechi pentru a suprascrie imaginea
    const urlParts = image.url.split("/");
    const publicIdWithExtension = urlParts
      .slice(urlParts.indexOf("saas-platform"))
      .join("/");
    const publicId = publicIdWithExtension.substring(
      0,
      publicIdWithExtension.lastIndexOf(".")
    );

    // 5. Încarcă noua imagine în Cloudinary, suprascriind-o pe cea veche
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, invalidate: true },
      (error, result) => {
        if (error)
          return res
            .status(500)
            .json({ message: "Eroare la re-upload Cloudinary." });
        // Nu trebuie să actualizăm DB-ul deoarece URL-ul rămâne același
        res.status(200).json({
          message: "Imaginea a fost rotită cu succes.",
          url: result.secure_url,
        });
      }
    );
    uploadStream.end(rotatedBuffer);
  } catch (error) {
    console.error("Image rotation error:", error);
    res.status(500).json({ message: "Eroare internă la rotirea imaginii." });
  }
};

module.exports = { rotateImage };
