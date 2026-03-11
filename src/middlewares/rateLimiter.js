// src/middlewares/rateLimiter.js
const rateLimit = require("express-rate-limit");

// Limiter STRICT pentru login — previne brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 10, // maxim 10 încercări per IP
  message: { message: "Prea multe încercări de autentificare. Încearcă din nou în 15 minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter pentru register — previne crearea în masă de conturi
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 oră
  max: 5, // maxim 5 înregistrări per IP pe oră
  message: { message: "Prea multe înregistrări. Încearcă din nou mai târziu." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter pentru formulare publice (contact, recenzii)
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 10, // maxim 10 trimiteri per IP
  message: { message: "Prea multe trimiteri. Încearcă din nou în 15 minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter general pentru endpoint-urile publice de search/browse
const publicBrowseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minut
  max: 60, // 60 request-uri per minut per IP
  message: { message: "Prea multe cereri. Încetinește puțin." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  publicFormLimiter,
  publicBrowseLimiter,
};