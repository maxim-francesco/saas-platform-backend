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

// --- FUNCȚIE NOUĂ: ACTUALIZARE PROFIL ---
const updateBusinessProfile = async (req, res) => {
  const { businessName, email, password } = req.body;
  const { businessId, userId } = req.user;

  try {
    // Folosim o tranzacție pentru a actualiza ambele tabele simultan
    await prisma.$transaction(async (prisma) => {
      // 1. Actualizăm numele afacerii (dacă este furnizat)
      if (businessName) {
        await prisma.business.update({
          where: { id: businessId },
          data: { name: businessName },
        });
      }

      // 2. Pregătim datele pentru user
      const userData = {};
      if (email) userData.email = email;
      
      if (password) {
        // Dacă se schimbă parola, o criptăm
        const hashedPassword = await bcrypt.hash(password, 10);
        userData.password = hashedPassword;
      }

      // 3. Actualizăm user-ul doar dacă avem date noi
      if (Object.keys(userData).length > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: userData,
        });
      }
    });

    res.status(200).json({ message: "Profilul a fost actualizat cu succes!" });
  } catch (error) {
    console.error("Eroare la actualizarea profilului:", error);
    // Gestionăm eroarea de email duplicat (P2002 este codul Prisma pentru Unique Constraint)
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return res.status(409).json({ message: "Acest email este deja folosit de altcineva." });
    }
    res.status(500).json({ message: "Eroare internă la actualizarea profilului." });
  }
};

module.exports = { uploadBanner, getMyBusiness, deleteBanner,updateBusinessProfile };
