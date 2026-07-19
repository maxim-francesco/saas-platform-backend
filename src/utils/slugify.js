const crypto = require("crypto");

const generateSlug = (text) => {
  if (!text) return "";
  return text.toString().toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Unambiguous alphabet (no 0/O/1/l/I)
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

const generateCode = (len = 8) => {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
};

module.exports = { generateSlug, generateCode };
