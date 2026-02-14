const prisma = require("../config/prismaClient");
const youtubeService = require("../services/youtubeService");

const getConnectUrl = (req, res) => {
  try {
    const url = youtubeService.getAuthUrl();
    res.json({ url });
  } catch (error) {
    console.error("Eroare detaliată la generare URL Auth:", error);
    res.status(500).json({ message: "Eroare internă la generarea URL-ului." });
  }
};

const handleCallback = async (req, res) => {
  const { code } = req.query;
  // Folosim un ID de test dacă req.user nu e disponibil, 
  // dar middleware-ul isAuthenticated ar trebui să îl ofere
  const businessId = req.user?.businessId; 

  try {
    const tokens = await youtubeService.getTokensFromCode(code);
    
    await prisma.business.update({
      where: { id: businessId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiresAt: new Date(tokens.expiry_date),
      },
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?youtube=success`);
  } catch (error) {
    console.error("Eroare OAuth YouTube Callback:", error);
    res.status(500).send("Eroare la salvarea token-urilor.");
  }
};

const getUploadUrl = async (req, res) => {
  const { businessId } = req.user;
  const { title, description } = req.body;

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business.googleRefreshToken) {
      return res.status(401).json({ message: "Cont YouTube neconectat." });
    }

    const auth = youtubeService.getYouTubeClient(
      business.googleAccessToken, 
      business.googleRefreshToken
    );

    const uploadUrl = await youtubeService.getResumableUploadUrl(auth, { title, description });

    res.json({ uploadUrl });
  } catch (error) {
    console.error("Eroare la generare URL Upload:", error);
    res.status(500).json({ message: "Nu s-a putut iniția încărcarea pe YouTube." });
  }
};

module.exports = { getConnectUrl, handleCallback,getUploadUrl };