const multer = require("multer");
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tip de fișier nepermis. Sunt acceptate doar: JPEG, PNG, WEBP, GIF."), false);
  }
};

const videoFilter = (req, file, cb) => {
  const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
  if (allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tip de fișier nepermis. Sunt acceptate doar: MP4, WEBM, MOV, AVI."), false);
  }
};

const uploadImage = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB pentru imagini
  fileFilter: imageFilter,
});

const uploadVideo = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB pentru video
  fileFilter: videoFilter,
});

module.exports = { uploadImage, uploadVideo };