const prisma = require("../config/prismaClient");
const cloudinary = require("../config/cloudinary");

// Funcția pentru a încărca un banner
const uploadBanner = async (req, res) => {
  const { businessId } = req.user;
  if (!req.file)
    return res.status(400).json({ message: "Niciun fișier încărcat." });

  const uploadStream = cloudinary.uploader.upload_stream(
    { resource_type: "image", folder: `saas-platform/${businessId}/template` },
    async (error, result) => {
      if (error)
        return res
          .status(500)
          .json({ message: "Eroare la upload Cloudinary." });

      const updatedBusiness = await prisma.business.update({
        where: { id: businessId },
        data: { bannerUrl: result.secure_url },
      });
      res.status(200).json(updatedBusiness);
    }
  );
  uploadStream.end(req.file.buffer);
};

// Funcția pentru a obține detaliile afacerii (inclusiv banner-ul)
const getMyBusiness = async (req, res) => {
  const { businessId } = req.user;
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  res.status(200).json(business);
};

const deleteBanner = async (req, res) => {
  const { businessId } = req.user;

  try {
    // 1. Găsim afacerea pentru a obține URL-ul banner-ului curent
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { bannerUrl: true }, // Selectăm doar câmpul de care avem nevoie
    });

    // Verificăm dacă există un banner de șters
    if (!business || !business.bannerUrl) {
      return res
        .status(404)
        .json({ message: "Niciun banner de șters nu a fost găsit." });
    }

    // 2. Extragem ID-ul public din URL-ul de pe Cloudinary pentru a-l șterge
    const publicIdMatch = business.bannerUrl.match(
      /upload\/(?:v\d+\/)?(.+?)\./
    );

    if (publicIdMatch && publicIdMatch[1]) {
      const publicId = publicIdMatch[1];
      // Trimitem comanda de ștergere către Cloudinary
      await cloudinary.uploader.destroy(publicId);
    } else {
      console.error(
        "Nu s-a putut extrage ID-ul public din URL-ul banner-ului:",
        business.bannerUrl
      );
    }

    // 3. Actualizăm în baza de date, setând bannerUrl la null
    await prisma.business.update({
      where: { id: businessId },
      data: { bannerUrl: null },
    });

    res.status(200).json({ message: "Banner-ul a fost șters cu succes." });
  } catch (error) {
    console.error("Eroare la ștergerea banner-ului:", error);
    res
      .status(500)
      .json({ message: "Eroare internă la ștergerea banner-ului." });
  }
};

module.exports = { uploadBanner, getMyBusiness, deleteBanner };
