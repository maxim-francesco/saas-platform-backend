const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 1. Generează URL-ul de logare pentru dealer
const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // IMPORTANT: pentru a primi refresh_token
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    prompt: 'consent'
  });
};

// 2. Schimbă codul de la Google pe Token-uri
const getTokensFromCode = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

// 3. Configurează clientul cu token-urile unui business
const getYouTubeClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth });
};

const getResumableUploadUrl = async (auth, metadata) => {
  // Metadata conține titlul și descrierea videoclipului
  const response = await auth.request({
    method: 'POST',
    url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    data: {
      snippet: {
        title: metadata.title || "Prezentare Auto",
        description: metadata.description || "Detalii mașină în descriere.",
        categoryId: '22', // Categoria "People & Blogs" sau '2' pentru "Autos & Vehicles"
      },
      status: {
        privacyStatus: 'unlisted', // Recomandat: unlisted pentru a nu umple canalul public imediat
        selfDeclaredMadeForKids: false,
      },
    },
    headers: {
      'X-Upload-Content-Type': 'video/*',
    },
  });

  // URL-ul sesiunii de upload se află în header-ul 'location'
  return response.headers.location;
};

module.exports = { getAuthUrl, getTokensFromCode, getYouTubeClient,getResumableUploadUrl };