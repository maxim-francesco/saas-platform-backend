// src/utils/encryption.js
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  // Stocăm iv:authTag:encrypted ca un singur string
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
};

const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !authTagHex || !encrypted) return encryptedText; // date vechi necriptate
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    // Dacă decriptarea eșuează, probabil e o valoare veche necriptată
    return encryptedText;
  }
};

module.exports = { encrypt, decrypt };