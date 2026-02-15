// src/services/youtubeService.js
const { google } = require('googleapis');

// Configurarea clientului cu datele din Google Cloud Console
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * GENERARE URL AUTENTIFICARE (Pasul 1 pentru obținerea token-ului tău)
 */
const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Necesar pentru a primi Refresh Token
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    prompt: 'consent' // Forțează Google să afișeze ecranul de permisiuni pentru a asigura primirea refresh_token-ului
  });
};

/**
 * SCHIMB COD PENTRU TOKEN (Pasul 2 pentru obținerea token-ului tău)
 */
const getTokensFromCode = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

/**
 * LOGICA DE UPLOAD (Folosită de clienți)
 */
const getResumableUploadUrl = async (metadata) => {
  // Setăm credențialele tale permanente din .env pentru upload
  oauth2Client.setCredentials({ 
    refresh_token: process.env.YOUTUBE_CHANNEL_REFRESH_TOKEN 
  });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  
  // Cerem un URL de upload direct de la Google
  const response = await youtube.context._options.auth.request({
    method: 'POST',
    url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    data: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        categoryId: '2', // Categoria "Autos & Vehicles"
      },
      status: {
        privacyStatus: 'unlisted', // Videoclipul nu va apărea public pe canal imediat
      },
    },
    headers: {
      'X-Upload-Content-Type': 'video/*',
    },
  });

  return response.headers.location; // Returnăm URL-ul unde frontend-ul va face PUT
};

module.exports = { 
  getAuthUrl, 
  getTokensFromCode, 
  getResumableUploadUrl 
};