const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Limită de 100MB pentru video
  },
  fileFilter: (req, file, cb) => {
    // Acceptăm doar formate video comune
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else if (file.mimetype.startsWith('image/')) {
      cb(null, true); // Păstrăm și suportul pentru imagini
    } else {
      cb(new Error('Format fișier neacceptat. Încărcați doar imagini sau video.'), false);
    }
  }
});

module.exports = upload;