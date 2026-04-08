const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");

const storage = multer.memoryStorage();

// Locație temporară pentru videoclipuri mari
const videoTempDir = path.join(os.tmpdir(), "saas-platform-uploads");
if (!fs.existsSync(videoTempDir)) {
  fs.mkdirSync(videoTempDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoTempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

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
  limits: { fileSize: 1000 * 1024 * 1024 }, // 50MB pentru imagini
  fileFilter: imageFilter,
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 1000 * 1024 * 1024 }, // 1GB pentru video
  fileFilter: videoFilter,
});

module.exports = { uploadImage, uploadVideo };