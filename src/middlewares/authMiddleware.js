// src/middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");

const isAuthenticated = (req, res, next) => {
  // 1. Preluăm header-ul de autorizare
  const authHeader = req.headers.authorization;

  // 2. Verificăm dacă header-ul există și are formatul corect ('Bearer TOKEN')
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Acces neautorizat. Token lipsește sau este invalid." });
  }

  // 3. Extragem token-ul, eliminând 'Bearer ' din față
  const token = authHeader.split(" ")[1];

  try {
    // 4. Verificăm și decodificăm token-ul folosind secretul nostru
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5. ATAȘĂM informațiile din token (payload) la obiectul `req`.
    // Acest pas este CRUCIAL. Acum, toate rutele care urmează după acest
    // middleware vor avea acces la `req.user` cu id-ul userului și al business-ului.
    req.user = decoded;

    // 6. Trecem la următorul middleware sau la controller-ul final
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token invalid sau expirat." });
  }
};

module.exports = { isAuthenticated };
