const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // Para hashear la nueva contraseña
const crypto = require('crypto'); // Para generar el token de reseteo
const { 
  registerUser, 
  loginUser, 
  validateRegistrationData,
  generateToken
} = require('../auth/auth');
const { 
  authenticateToken, 
  requireManager 
} = require('../auth/auth');
const { 
  updateUserPreferences, 
  getPredictionMetrics, 
  getModelAccuracyStats,
  getUserById,
  getUserByEmail,
  getUserByConfirmationToken,
  confirmUserEmail,
  deleteUserById,
  setResetPasswordToken,
  getUserByValidResetToken,
  updateUserPassword
} = require('../database/db');
const { sendConfirmationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../services/email_service');

// --- Plantillas HTML para respuestas de confirmación ---

function getConfirmationResponsePageTemplate(title, message, userName, showLoginLink = false) {
  const frontendUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
  // Intentamos obtener la URL del logo de forma similar a los emails, pero con fallback simple si no está en env
  const logoPath = '/src/components/logos/air_gijon_logo_v1.png'; // Ruta relativa en el frontend
  const logoUrl = process.env.FRONTEND_URL ? `${frontendUrl}${logoPath}` : `https://air-gijon-front-end.onrender.com${logoPath}`;


  let loginLinkHtml = '';
  if (showLoginLink) {
    loginLinkHtml = `<p style="margin-top: 30px; text-align: center;"><a href="${frontendUrl}" style="display: inline-block; padding: 12px 25px; background-color: #0075FF; color: white; text-decoration: none; border-radius: 6px; font-size: 16px;">Iniciar Sesión</a></p>`;
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Air Gijón - ${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: "Inter", sans-serif; margin: 0; padding: 20px; background-color: #F0F7FF; display: flex; justify-content: center; align-items: center; min-height: 100vh; text-align: center; color: #333; }
        .container { background-color: #FFFFFF; padding: 30px 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px; width: 100%; }
        img.logo { max-width: 180px; margin-bottom: 25px; }
        h1 { color: #0052B2; font-size: 28px; margin-bottom: 15px; }
        p { font-size: 16px; line-height: 1.6; margin-bottom: 10px; }
        a { color: #0075FF; }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="${logoUrl}" alt="Air Gijón Logo" class="logo">
        <h1>${title}</h1>
        <p>${userName ? `Hola ${userName},<br><br>` : ''}${message}</p>
        ${loginLinkHtml}
      </div>
    </body>
    </html>
  `;
}

// --- Fin Plantillas HTML ---

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

    // Registrar usuario (ahora devuelve también confirmation_token)
    const result = await registerUser(email, password, 'external', name?.trim() || null);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Construir el enlace de confirmación
    // Usar el backend URL para confirmación de correo
    const backendBaseUrl = process.env.BASE_URL || 'https://air-gijon-backend.onrender.com';
    const confirmationLink = `${backendBaseUrl}/api/users/confirmar-correo/${result.confirmation_token}`;

    // Enviar email de confirmación (no bloqueante)
    sendConfirmationEmail(result.user.email, result.user.name, confirmationLink, result.user.id)
      .catch(error => console.error('Error enviando email de confirmación:', error));
    
    // Opcional: Aún podemos enviar el de bienvenida, o esperar a la confirmación.
    // Por ahora, lo dejamos para dar feedback inmediato.
    // sendWelcomeEmail(result.user.email, result.user.name, result.user.id)
    //  .catch(error => console.error('Error enviando email de bienvenida tras registro:', error));

    res.status(201).json({
      success: true,
      message: 'Usuario registrado. Por favor, revisa tu correo para confirmar tu cuenta y poder iniciar sesión.',
      user: {
        email: result.user.email,
        name: result.user.name
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/users/confirmar-correo/:token - Confirmación de correo
router.get('/confirmar-correo/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await getUserByConfirmationToken(token);

    if (!user) {
      return res.status(400).send(
        getConfirmationResponsePageTemplate(
          'Enlace Inválido',
          'Este enlace de confirmación no es válido o ha expirado. Por favor, intenta registrarte de nuevo o contacta con soporte si el problema persiste.',
          null
        )
      );
    }

    const confirmedUser = await confirmUserEmail(user.id);

    sendWelcomeEmail(confirmedUser.email, confirmedUser.name, confirmedUser.id)
      .catch(error => console.error('Error enviando email de bienvenida tras confirmación:', error));

    // Generar token de sesión para login automático
    const sessionToken = generateToken(confirmedUser);
    const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
    const redirectUrl = `${frontendBaseUrl}/auth/callback?token=${sessionToken}`;

    console.log(`📧 Correo confirmado para ${confirmedUser.email}. Redirigiendo a: ${redirectUrl}`);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error en confirmación de correo:', error);
    // Devolver la página de error genérica en caso de fallo
    res.status(500).send(
      getConfirmationResponsePageTemplate(
        'Error en la Confirmación',
        'Ocurrió un error interno al intentar confirmar tu correo. Por favor, inténtalo más tarde o contacta con soporte.',
        null
      )
    );
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

    // >>> NUEVA VERIFICACIÓN: Comprobar si el correo está confirmado
    if (!result.user.is_confirmed) {
      // Opcional: Reenviar correo de confirmación aquí si se desea.
      // const confirmationLink = `${process.env.BASE_URL || 'http://localhost:3000'}/api/users/confirmar-correo/${EXISTING_TOKEN_IF_ANY}`;
      // sendConfirmationEmail(result.user.email, result.user.name, confirmationLink, result.user.id);
      return res.status(403).json({
        success: false,
        error: 'Debes confirmar tu correo electrónico antes de iniciar sesión.',
        code: 'EMAIL_NOT_CONFIRMED'
      });
    }
    // <<< FIN NUEVA VERIFICACIÓN

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

// DELETE /api/users/me - Eliminar la cuenta del usuario autenticado
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Lógica para eliminar el usuario de la base de datos
    // Esto dependerá de cómo esté implementada tu función en db.js
    // Supongamos que tienes una función deleteUserById(id)
    const deletionResult = await deleteUserById(userId);

    if (!deletionResult || !deletionResult.success) {
      // Si deleteUserById devuelve un objeto con { success: false, error: '...' }
      // o simplemente no devuelve nada en caso de fallo sin error explícito.
      let errorMessage = 'No se pudo eliminar la cuenta.';
      if (deletionResult && deletionResult.error) {
        errorMessage = deletionResult.error;
      }
      // Podrías querer loguear el error específico en el servidor aunque no lo devuelvas al cliente
      console.error(`Error al intentar eliminar usuario ${userId}:`, errorMessage);
      return res.status(500).json({ // Usar 500 si es un error del servidor, o 404 si el user no existiese (aunque authenticateToken ya lo valida)
        success: false,
        error: errorMessage
      });
    }

    // Aquí podrías realizar acciones adicionales, como:
    // - Invalidar tokens activos (si tienes un sistema de lista negra de tokens)
    // - Enviar un email de despedida (opcional)

    res.status(200).json({
      success: true,
      message: 'Tu cuenta ha sido eliminada exitosamente.'
    });

  } catch (error) {
    console.error('Error eliminando cuenta de usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor al intentar eliminar la cuenta.'
    });
  }
});

// --- Rutas para Reseteo de Contraseña ---

// POST /api/users/forgot-password - Solicitar reseteo de contraseña
router.post('/forgot-password', async (req, res) => {
  console.log('[FORGOT_PASSWORD] Received request:', req.body);
  try {
    const { email } = req.body;

    if (!email) {
      console.log('[FORGOT_PASSWORD] Email missing');
      return res.status(400).json({
        success: false,
        error: 'Email es requerido'
      });
    }

    console.log(`[FORGOT_PASSWORD] Searching user by email: ${email}`);
    const user = await getUserByEmail(email);

    if (user && user.is_confirmed) {
      console.log(`[FORGOT_PASSWORD] User found and confirmed: ${user.id}, ${user.email}`);
      const token = crypto.randomBytes(32).toString('hex');
      console.log(`[FORGOT_PASSWORD] Generated token: ${token}`);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora desde ahora
      console.log(`[FORGOT_PASSWORD] Token expires at: ${expiresAt.toISOString()}`);

      await setResetPasswordToken(user.id, token, expiresAt);
      console.log(`[FORGOT_PASSWORD] Token set in DB for user ${user.id}`);

      const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
      const resetLink = `${frontendBaseUrl}/reset-password?token=${token}`;
      console.log(`[FORGOT_PASSWORD] Constructed reset link: ${resetLink}`);

      // Enviar email de reseteo de contraseña
      // Asumiendo que sendPasswordResetEmail existe en email_service.js
      // y maneja sus propios logs internos sobre el éxito/fallo del envío.
      console.log(`[FORGOT_PASSWORD] Attempting to send password reset email to ${user.email} for user ID ${user.id}`);
      sendPasswordResetEmail(user.email, user.name, resetLink, user.id)
        .then(emailResult => {
          if (emailResult && emailResult.success) {
            console.log(`[FORGOT_PASSWORD] Password reset email queued successfully for ${user.email}. Message ID: ${emailResult.messageId}`);
          } else {
            console.error(`[FORGOT_PASSWORD] Failed to send password reset email to ${user.email}. Result:`, emailResult);
          }
        })
        .catch(error => {
          console.error(`[FORGOT_PASSWORD] Critical error calling sendPasswordResetEmail for ${user.email}:`, error);
        });

    } else if (user && !user.is_confirmed) {
      console.log(`[FORGOT_PASSWORD] User found but not confirmed: ${email}`);
      // No hacer nada, responder genéricamente
    } else {
      console.log(`[FORGOT_PASSWORD] User not found: ${email}`);
      // No hacer nada, responder genéricamente
    }

    // Responder siempre con éxito para evitar enumeración de usuarios
    res.json({
      success: true,
      message: 'Si tu correo electrónico está registrado y confirmado, recibirás un enlace para restablecer tu contraseña.'
    });

  } catch (error) {
    console.error('[FORGOT_PASSWORD] Error en la ruta /forgot-password:', error);
    // Responder genéricamente incluso en caso de error interno
    res.status(200).json({ // Cambiado a 200 para que coincida con el flujo normal
      success: true, // Aunque sea un error interno, se simula éxito al cliente
      message: 'Si tu correo electrónico está registrado y confirmado, recibirás un enlace para restablecer tu contraseña.'
    });
  }
});

// POST /api/users/reset-password/:token - Resetear la contraseña
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) { // Validación básica de contraseña
      return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const user = await getUserByValidResetToken(token);

    if (!user) {
      return res.status(400).json({ success: false, error: 'El token de reseteo no es válido o ha expirado.' });
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await updateUserPassword(user.id, newPasswordHash);

    // TODO: (Opcional) Enviar email de confirmación de cambio de contraseña
    /*
    sendPasswordChangedConfirmationEmail(user.email, user.name, user.id)
      .catch(err => console.error(\`Error enviando email de confirmación de cambio de contraseña a ${user.email}: \`, err));
    */

    res.json({ success: true, message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.' });

  } catch (error) {
    console.error('Error en /reset-password:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET /api/users/test-predictions - Test de correos de predicciones (temporal)
router.get('/test-predictions', async (req, res) => {
  try {
    console.log('🧪 Testing prediction emails...');
    
    const { sendDailyPredictions } = require('../services/email_service');
    const { getUsersForDailyPredictions } = require('../database/db');
    
    // Obtener usuarios suscritos a predicciones
    const users = await getUsersForDailyPredictions('predictions');
    
    if (users.length === 0) {
      return res.json({
        success: false,
        message: 'No hay usuarios suscritos a predicciones diarias',
        users_found: 0
      });
    }
    
    // Datos de prueba para predicciones
    const testPredictions = users.map(user => ({
      email: user.email,
      user_name: user.name,
      user_id: user.id,
      hoy: {
        fecha: '2025-06-09',
        valor: 45,
        modelo: 'LightGBM Test',
        roc_index: 0.85
      },
      manana: {
        fecha: '2025-06-10',  
        valor: 38,
        modelo: 'LightGBM Test',
        roc_index: 0.85
      },
      fecha_hoy_format: '9 de junio',
      fecha_manana_format: '10 de junio'
    }));
    
    console.log(`📧 Enviando predicciones de prueba a ${users.length} usuarios...`);
    
    // Enviar correos de prueba
    const results = await sendDailyPredictions(testPredictions);
    
    const exitosos = results.filter(r => r.status === 'enviado').length;
    const fallidos = results.filter(r => r.status === 'error').length;
    
    res.json({
      success: true,
      message: 'Test de predicciones completado',
      stats: {
        total_users: users.length,
        emails_sent: exitosos,
        emails_failed: fallidos
      },
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error en test de predicciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

// GET /api/users/test-alerts - Test de correos de alertas (temporal)
router.get('/test-alerts', async (req, res) => {
  try {
    console.log('🧪 Testing alert emails...');
    
    const { sendAirQualityAlert } = require('../services/email_service');
    const { getUsersForDailyPredictions } = require('../database/db');
    
    // Obtener usuarios suscritos a alertas
    const users = await getUsersForDailyPredictions('alerts');
    
    if (users.length === 0) {
      return res.json({
        success: false,
        message: 'No hay usuarios suscritos a alertas',
        users_found: 0
      });
    }
    
    // Datos de prueba para alerta (PM2.5 alto)
    const testAlertData = {
      valor: 65,
      estado: 'Pobre',
      estacion: 'Avenida Constitución',
      fecha: new Date()
    };
    
    console.log(`🚨 Enviando alertas de prueba a ${users.length} usuarios...`);
    
    let alertsSent = 0;
    let alertsFailed = 0;
    const results = [];
    
    // Enviar alertas de prueba
    for (const user of users) {
      try {
        await sendAirQualityAlert(user.email, user.name, testAlertData, user.id);
        console.log(`✅ Alerta enviada a ${user.email}`);
        results.push({
          email: user.email,
          status: 'enviado'
        });
        alertsSent++;
      } catch (error) {
        console.error(`❌ Error enviando alerta a ${user.email}:`, error);
        results.push({
          email: user.email,
          status: 'error',
          error: error.message
        });
        alertsFailed++;
      }
    }
    
    res.json({
      success: true,
      message: 'Test de alertas completado',
      stats: {
        total_users: users.length,
        alerts_sent: alertsSent,
        alerts_failed: alertsFailed
      },
      test_data: testAlertData,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error en test de alertas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router; 