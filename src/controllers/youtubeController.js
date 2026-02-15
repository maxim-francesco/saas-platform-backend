const youtubeService = require("../services/youtubeService");

const getUploadUrl = async (req, res) => {
  const { title } = req.body; 
  try {
    const uploadUrl = await youtubeService.getResumableUploadUrl({
      title: `Prezentare: ${title}`,
      description: "Video urcat prin platforma SaaS Auto."
    });

    if (!uploadUrl) {
      return res.status(500).json({ message: "Nu s-a putut genera URL-ul." });
    }

    res.json({ uploadUrl }); // Cheia trebuie să fie "uploadUrl"
  } catch (error) {
    res.status(500).json({ message: "Eroare la Google." });
  }
};

module.exports = { getUploadUrl };