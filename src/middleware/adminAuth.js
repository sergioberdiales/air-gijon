const jwt = require("jsonwebtoken");
const { getUserById } = require("../database/db");

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "air-gijon-secret-key-2024");
    
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Autenticación requerida" });
  }

  if (req.user.role_name !== "admin") {
    return res.status(403).json({ 
      error: "Acceso denegado. Se requieren permisos de administrador." 
    });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };
