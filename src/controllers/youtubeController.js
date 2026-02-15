const youtubeService = require("../services/youtubeService");

const getUploadUrl = async (req, res) => {
  const { title } = req.body; 

  try {
    const uploadUrl = await youtubeService.getResumableUploadUrl({
      title: `Prezentare: ${title}`,
      description: "Video urcat prin platforma SaaS Auto."
    });

    res.json({ uploadUrl });
  } catch (error) {
    console.error("Eroare la generare URL Upload YouTube:", error);
    res.status(500).json({ message: "Eroare la inițierea upload-ului." });
  }
};

module.exports = { getUploadUrl };