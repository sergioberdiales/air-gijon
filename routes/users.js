const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser, 
  validateRegistrationData 
} = require('../auth');
const { 
  authenticateToken, 
  requireManager 
} = require('../auth');
const { 
  updateUserPreferences, 
  getPredictionMetrics, 
  getModelAccuracyStats,
  getUserById
} = require('../db');
const { sendWelcomeEmail } = require('../email_service');

// POST /api/users/register - Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validar datos de entrada
    const validationErrors = validateRegistrationData(email, password, name);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Datos de registro inválidos',
        details: validationErrors
      });
    }

    // Registrar usuario
    const result = await registerUser(email, password, 'external', name?.trim() || null);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Enviar email de bienvenida (no bloqueante)
    sendWelcomeEmail(result.user.email, result.user.name, result.user.id)
      .catch(error => console.error('Error enviando email de bienvenida:', error));

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/users/login - Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    const result = await loginUser(email, password);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Login exitoso',
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/users/profile - Obtener perfil del usuario
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // Obtener información completa del usuario de la base de datos
    const fullUser = await getUserById(req.user.id);
    
    if (!fullUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    res.json({
      success: true,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        role: fullUser.role,
        name: fullUser.name,
        email_alerts: fullUser.email_alerts,
        daily_predictions: fullUser.daily_predictions,
        created_at: fullUser.created_at,
        last_login: fullUser.last_login
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// PUT /api/users/preferences - Actualizar preferencias de notificación
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { email_alerts, daily_predictions } = req.body;

    // Validar tipos
    if (typeof email_alerts !== 'boolean' || typeof daily_predictions !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'email_alerts y daily_predictions deben ser valores booleanos'
      });
    }

    const updatedUser = await updateUserPreferences(req.user.id, {
      email_alerts,
      daily_predictions
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente',
      preferences: {
        email_alerts: updatedUser.email_alerts,
        daily_predictions: updatedUser.daily_predictions
      }
    });

  } catch (error) {
    console.error('Error actualizando preferencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/users/dashboard - Dashboard para gestores
router.get('/dashboard', authenticateToken, requireManager, async (req, res) => {
  try {
    // Obtener métricas de predicciones
    const metrics = await getPredictionMetrics(30); // Últimas 30 predicciones
    const accuracyStats = await getModelAccuracyStats('Modelo Predictivo 0.0');

    // Calcular métricas adicionales
    const totalMetrics = metrics.length;
    const accuracyByDay = {};
    
    metrics.forEach(metric => {
      const day = metric.fecha_real.toISOString().split('T')[0];
      if (!accuracyByDay[day]) {
        accuracyByDay[day] = {
          date: day,
          predictions: 0,
          totalError: 0,
          averageError: 0
        };
      }
      accuracyByDay[day].predictions++;
      accuracyByDay[day].totalError += parseFloat(metric.error_absoluto);
      accuracyByDay[day].averageError = accuracyByDay[day].totalError / accuracyByDay[day].predictions;
    });

    const dailyAccuracy = Object.values(accuracyByDay)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7); // Últimos 7 días

    res.json({
      success: true,
      dashboard: {
        model: {
          name: 'Modelo Predictivo 0.0',
          version: '1.0',
          type: 'Promedio Ponderado',
          confidence: '80%'
        },
        stats: {
          total_predictions: parseInt(accuracyStats.total_predicciones) || 0,
          average_error: parseFloat(accuracyStats.error_absoluto_promedio) || 0,
          average_error_percentage: parseFloat(accuracyStats.error_relativo_promedio) || 0,
          best_prediction: parseFloat(accuracyStats.mejor_prediccion) || 0,
          worst_prediction: parseFloat(accuracyStats.peor_prediccion) || 0,
          standard_deviation: parseFloat(accuracyStats.desviacion_estandar) || 0
        },
        recent_predictions: metrics.slice(0, 10), // 10 más recientes
        daily_accuracy: dailyAccuracy,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/users/test-email - Test de email (solo gestores)
router.post('/test-email', authenticateToken, requireManager, async (req, res) => {
  try {
    const { type = 'welcome' } = req.body;
    const { sendWelcomeEmail, getDailyPredictionTemplate } = require('../email_service');

    let result;
    
    if (type === 'welcome') {
      result = await sendWelcomeEmail(req.user.email, req.user.name, req.user.id);
    } else if (type === 'prediction') {
      // Datos de prueba para predicción
      const testData = {
        hoy: { valor: 25, fecha: '2024-05-28' },
        manana: { valor: 30, fecha: '2024-05-29' },
        fecha: '28 de Mayo, 2024'
      };
      
      const htmlContent = getDailyPredictionTemplate(testData);
      const { sendEmail } = require('../email_service');
      result = await sendEmail(
        req.user.email,
        '🧪 Test - Predicción Diaria',
        htmlContent,
        req.user.id,
        'test'
      );
    }

    res.json({
      success: result.success,
      message: result.success ? 'Email de prueba enviado' : 'Error enviando email',
      details: result
    });

  } catch (error) {
    console.error('Error enviando email de prueba:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router; 