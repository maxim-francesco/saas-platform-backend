const multer = require("multer");
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB — suficient pentru video-uri
  }
});

module.exports = upload;