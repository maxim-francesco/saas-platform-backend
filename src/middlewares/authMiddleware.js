const jwt = require("jsonwebtoken");
const prisma = require("../config/prismaClient");

const isAuthenticated = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Acces neautorizat. Token lipsește sau este invalid." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificăm tokenVersion din DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { tokenVersion: true },
    });

    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({ message: "Token invalidat. Te rugăm să te autentifici din nou." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token invalid sau expirat." });
  }
};

module.exports = { isAuthenticated };