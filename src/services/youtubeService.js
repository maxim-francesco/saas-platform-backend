const { google } = require('googleapis');
const stream = require('stream');

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
});

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

const uploadToYouTube = async (file, title, description) => {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);

  const response = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: title || 'Prezentare Auto',
        description: description || 'Prezentare video realizata prin platforma SaaS.',
        categoryId: '22' // Category: Autos & Vehicles
      },
      status: {
        privacyStatus: 'unlisted', // Sa nu apara public pe canal
        selfDeclaredMadeForKids: false,
      }
    },
    media: {
      body: bufferStream
    }
  });

  return response.data.id; // Returneaza youtubeVideoId
};

module.exports = { uploadToYouTube };