// src/controllers/youtubeController.js
const youtubeService = require("../services/youtubeService");

const getUploadUrl = async (req, res) => {
  const { title } = req.body; 

  try {
    // Ne asigurăm că titlul este un string valid
    const uploadUrl = await youtubeService.getResumableUploadUrl({
      title: title || "Anunț Auto Fără Titlu",
      description: "Prezentare video realizată prin platforma SaaS."
    });

    if (!uploadUrl) {
      return res.status(500).json({ message: "YouTube nu a returnat un URL." });
    }

    res.json({ uploadUrl });
  } catch (error) {
    console.error("Eroare controller YouTube:", error.message);
    res.status(500).json({ message: "Eroare internă la inițierea upload-ului." });
  }
};

module.exports = { getUploadUrl };