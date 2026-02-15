// src/services/youtubeService.js
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const getResumableUploadUrl = async (metadata) => {
  try {
    // Setăm credențialele tale permanente
    oauth2Client.setCredentials({ 
      refresh_token: process.env.YOUTUBE_CHANNEL_REFRESH_TOKEN 
    });

    // Inițiem cererea brută către endpoint-ul de upload al Google
    const res = await oauth2Client.request({
      method: 'POST',
      url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      data: {
        snippet: {
          title: metadata.title || "Prezentare Auto",
          description: metadata.description || "Video încărcat prin platformă",
          categoryId: "2" // Categoria 'Autos & Vehicles'
        },
        status: {
          privacyStatus: "unlisted" //
        }
      },
      headers: {
        'X-Upload-Content-Type': 'video/*',
      }
    });

    // Google returnează URL-ul sesiunii în header-ul 'location'
    return res.headers.location;
  } catch (error) {
    // Logăm eroarea detaliată pentru a vedea exact ce argument este invalid
    console.error("Eroare detaliată Google API:", JSON.stringify(error.response?.data || error.message, null, 2));
    throw error;
  }
};

module.exports = { getResumableUploadUrl };