const prisma = require("../config/prismaClient");
const youtubeService = require("../services/youtubeService");

const getConnectUrl = (req, res) => {
  const url = youtubeService.getAuthUrl();
  res.json({ url });
};

const handleCallback = async (req, res) => {
  const { code } = req.query;
  const { businessId } = req.user; // Din middleware-ul de auth

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

    // Redirecționăm înapoi în Dashboard-ul de Frontend
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?youtube=success`);
  } catch (error) {
    console.error("Eroare OAuth YouTube:", error);
    res.status(500).send("Eroare la conectarea cu Google.");
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