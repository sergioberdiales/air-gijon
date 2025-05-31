const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createUser, getUserByEmail } = require('./db');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'air-gijon-secret-key-2024';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const SALT_ROUNDS = 12;

// Generar hash de contraseña
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Verificar contraseña
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Generar JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

// Verificar JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware de autenticación
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Token de acceso requerido',
      code: 'NO_TOKEN'
    });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ 
      error: 'Token inválido o expirado',
      code: 'INVALID_TOKEN'
    });
  }

  req.user = user;
  next();
}

// Middleware de autorización por rol
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: `Acceso denegado. Se requiere rol: ${role}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

// Middleware para validar que el usuario sea manager
const requireManager = requireRole('manager');

// Función para registrar usuario
async function registerUser(email, password, role = 'external', name = null) {
  try {
    // Verificar si el usuario ya existe
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      if (!existingUser.is_confirmed) {
        // TODO: Considerar reenviar email de confirmación si no está confirmado y se intenta registrar de nuevo.
        // Por ahora, mantenemos el error genérico para no revelar si el email existe.
      }
      throw new Error('El email ya está registrado');
    }

    // Validar formato del email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Formato de email inválido');
    }

    // Validar contraseña
    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    // Crear hash de la contraseña
    const passwordHash = await hashPassword(password);

    // Generar token de confirmación
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expira en 24 horas

    // Crear usuario con token de confirmación
    const newUser = await createUser(
      email, 
      passwordHash, 
      role, 
      name, 
      confirmationToken, 
      tokenExpiresAt
    );

    // Generar token JWT de sesión (se sigue generando para login inmediato si se desea)
    const sessionToken = generateToken(newUser);

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        is_confirmed: newUser.is_confirmed,
        created_at: newUser.created_at
      },
      token: sessionToken,
      confirmation_token: confirmationToken
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Función para login
async function loginUser(email, password) {
  try {
    // Obtener usuario
    const user = await getUserByEmail(email);
    if (!user) {
      throw new Error('Email o contraseña incorrectos');
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Email o contraseña incorrectos');
    }

    // Generar token
    const token = generateToken(user);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        email_alerts: user.email_alerts,
        daily_predictions: user.daily_predictions,
        last_login: user.last_login
      },
      token
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Validar datos de registro
function validateRegistrationData(email, password, name) {
  const errors = [];

  if (!email || !email.trim()) {
    errors.push('Email es requerido');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Formato de email inválido');
    }
  }

  if (!password || password.length < 6) {
    errors.push('La contraseña debe tener al menos 6 caracteres');
  }

  if (name && name.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }

  return errors;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateToken,
  requireRole,
  requireManager,
  registerUser,
  loginUser,
  validateRegistrationData
}; 