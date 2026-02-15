// src/services/youtubeService.js
const { google } = require('googleapis');

// Creăm clientul OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const getResumableUploadUrl = async (metadata) => {
  try {
    // Setăm refresh token-ul tău permanent
    oauth2Client.setCredentials({ 
      refresh_token: process.env.YOUTUBE_CHANNEL_REFRESH_TOKEN 
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    // Inițiem sesiunea de upload resumable
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          categoryId: '2', // Autos & Vehicles
        },
        status: {
          privacyStatus: 'unlisted', //
        },
      },
      media: {
        body: '', // Trimitem corpul gol pentru a obține doar URL-ul de sesiune
      },
    }, {
      // Această opțiune forțează returnarea URL-ului de upload în loc de execuția upload-ului pe server
      onUploadProgress: () => {} 
    });

    // YouTube returnează URL-ul în header-ul 'location' prin axos-ul intern al googleapis
    const res = await oauth2Client.request({
      method: 'POST',
      url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      data: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          categoryId: '2',
        },
        status: { privacyStatus: 'unlisted' }
      },
      headers: {
        'X-Upload-Content-Type': 'video/*',
      }
    });

    return res.headers.location;
  } catch (error) {
    console.error("Eroare la Google API:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = { getResumableUploadUrl };