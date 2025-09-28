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

module.exports = { uploadBanner, getMyBusiness };
