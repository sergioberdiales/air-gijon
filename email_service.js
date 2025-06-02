const nodemailer = require('nodemailer');
const { logNotificationSent, getUsersForDailyPredictions } = require('./db');
const { getEstadoPM25, getColorEstado } = require('./utils');

// Configuración del transporter de email
const transporter = nodemailer.createTransport({
  service: 'gmail', // o el servicio que prefieras
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // App Password para Gmail
  }
});

// Verificar configuración del email
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('✅ Configuración de email verificada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error en configuración de email:', error.message);
    return false;
  }
}

// Plantilla base para emails
function getBaseEmailTemplate(title, content, footerText = '') {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0; 
          padding: 20px; 
          background-color: #f5f5f5; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          font-weight: 600;
        }
        .content { 
          padding: 30px 20px; 
        }
        .footer { 
          background: #f8f9fa; 
          padding: 20px; 
          text-align: center; 
          color: #666; 
          font-size: 14px;
        }
        .quality-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          color: white;
          font-weight: 600;
          margin: 10px 0;
        }
        .prediction-card {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 15px 0;
          border-radius: 0 8px 8px 0;
        }
        .metric {
          text-align: center;
          margin: 20px 0;
        }
        .metric .value {
          font-size: 36px;
          font-weight: bold;
          color: #333;
        }
        .metric .unit {
          color: #666;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌤️ Air Gijón</h1>
          <p>Monitoreo de Calidad del Aire</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          ${footerText}
          <p>Air Gijón - Sistema de Monitoreo de Calidad del Aire<br>
          Este es un email automático, no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Plantilla para predicción diaria
function getDailyPredictionTemplate(predictionData) {
  const { hoy, manana, fecha } = predictionData;
  
  const estadoHoy = getEstadoPM25(hoy.valor);
  const estadoManana = getEstadoPM25(manana.valor);
  const colorHoy = getColorEstado(estadoHoy);
  const colorManana = getColorEstado(estadoManana);

  const content = `
    <h2>📊 Predicción de Calidad del Aire</h2>
    <p><strong>Fecha:</strong> ${fecha}</p>
    
    <div class="prediction-card">
      <h3>🌅 Hoy - ${hoy.fecha}</h3>
      <div class="metric">
        <div class="value">${hoy.valor}</div>
        <div class="unit">µg/m³ PM2.5</div>
      </div>
      <div class="quality-badge" style="background-color: ${colorHoy};">
        ${estadoHoy}
      </div>
    </div>

    <div class="prediction-card">
      <h3>🌄 Mañana - ${manana.fecha}</h3>
      <div class="metric">
        <div class="value">${manana.valor}</div>
        <div class="unit">µg/m³ PM2.5</div>
      </div>
      <div class="quality-badge" style="background-color: ${colorManana};">
        ${estadoManana}
      </div>
    </div>

    <p><em>Predicción generada por el Modelo Predictivo 0.0 con 80% de confianza.</em></p>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">
        Ver Dashboard Completo
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    'Predicción Diaria - Air Gijón',
    content,
    '<p>Para cancelar estas notificaciones, <a href="#">haz clic aquí</a></p>'
  );
}

// Plantilla para alerta de calidad del aire
function getAlertTemplate(alertData) {
  const { valor, estado, estacion, fecha } = alertData;
  const color = getColorEstado(estado);

  const content = `
    <h2>🚨 Alerta de Calidad del Aire</h2>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Se ha detectado un cambio significativo en la calidad del aire:</strong></p>
    </div>

    <div class="metric">
      <div class="value">${valor}</div>
      <div class="unit">µg/m³ PM2.5</div>
    </div>
    
    <div class="quality-badge" style="background-color: ${color};">
      ${estado}
    </div>

    <p><strong>Estación:</strong> ${estacion}</p>
    <p><strong>Fecha:</strong> ${fecha}</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">
        Ver Detalles
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    'Alerta de Calidad del Aire - Air Gijón',
    content
  );
}

// Plantilla de bienvenida
function getWelcomeTemplate(userName) {
  const content = `
    <h2>👋 ¡Bienvenido a Air Gijón!</h2>
    
    <p>Hola ${userName || 'Usuario'},</p>
    
    <p>Te has registrado exitosamente en nuestro sistema de monitoreo de calidad del aire. 
    Ahora podrás recibir:</p>
    
    <ul>
      <li>📅 <strong>Predicciones diarias</strong> de PM2.5</li>
      <li>🚨 <strong>Alertas automáticas</strong> cuando la calidad del aire cambie</li>
      <li>📊 <strong>Acceso al dashboard</strong> con datos en tiempo real</li>
    </ul>
    
    <p>Puedes gestionar tus preferencias de notificación desde tu perfil.</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">
        Ir al Dashboard
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    'Bienvenido a Air Gijón',
    content,
    '<p>¡Gracias por unirte a nosotros!</p>'
  );
}

// Plantilla para email de confirmación de cuenta
function getConfirmationEmailTemplate(userName, confirmationLink) {
  const content = `
    <h2>✅ Confirma tu Cuenta en Air Gijón</h2>
    
    <p>Hola ${userName || 'Usuario'},</p>
    
    <p>¡Gracias por registrarte en Air Gijón! Solo falta un paso más para activar tu cuenta.</p>
    
    <p>Por favor, haz clic en el siguiente enlace para confirmar tu dirección de correo electrónico:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmationLink}" class="button" style="background-color: #28a745; color: white;">
        Confirmar mi Correo Electrónico
      </a>
    </div>
    
    <p>Si no puedes hacer clic en el botón, copia y pega la siguiente URL en tu navegador:</p>
    <p><a href="${confirmationLink}">${confirmationLink}</a></p>
    
    <p>Este enlace de confirmación es válido por 24 horas. Si expira, puedes solicitar uno nuevo intentando iniciar sesión o desde la sección de 'reenviar confirmación' (si está disponible).</p>
    
    <p>Si no te registraste en Air Gijón, por favor ignora este correo.</p>
  `;

  return getBaseEmailTemplate(
    'Confirma tu Cuenta - Air Gijón',
    content,
    '<p>Equipo Air Gijón</p>'
  );
}

// Enviar email
async function sendEmail(to, subject, htmlContent, userId = null, type = 'general') {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USER o EMAIL_PASSWORD no están configuradas en las variables de entorno. No se pueden enviar emails.');
    return { success: false, message: "Variables de entorno de email no configuradas." };
  }

  const mailOptions = {
    from: `"Air Gijón" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado (${type}) a ${to}: ${info.messageId}`);
    // Registrar notificación si es relevante y se proporciona userId
    if (userId) {
      await logNotificationSent(userId, type, to, subject);
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error enviando email (${type}) a ${to}:`, error);
    console.error(`Detalles del error: Code: ${error.code}, Command: ${error.command}`);
    // No registrar como enviado si hay error
    return { success: false, error: error.message, code: error.code, command: error.command };
  }
}

// Enviar predicción diaria a todos los usuarios suscritos
async function sendDailyPredictions(predictionData) {
  try {
    const users = await getUsersForDailyPredictions();
    console.log(`📧 Enviando predicciones diarias a ${users.length} usuarios...`);

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    for (const user of users) {
      const htmlContent = getDailyPredictionTemplate(predictionData);
      const subject = `🌤️ Predicción Diaria - ${predictionData.fecha}`;
      
      const result = await sendEmail(
        user.email,
        subject,
        htmlContent,
        user.id,
        'daily_prediction'
      );

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({
          email: user.email,
          error: result.error
        });
      }

      // Pequeña pausa para evitar spam
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Resumen de envío: ${results.sent} enviados, ${results.failed} fallidos`);
    return results;

  } catch (error) {
    console.error('❌ Error enviando predicciones diarias:', error.message);
    throw error;
  }
}

// Enviar email de bienvenida
async function sendWelcomeEmail(userEmail, userName, userId) {
  try {
    const htmlContent = getWelcomeTemplate(userName);
    const mailOptions = {
      from: `"Air Gijón" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: '¡Bienvenido a Air Gijón!',
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email de bienvenida enviado a ${userEmail}: ${info.messageId}`);
    await logNotificationSent(userId, 'welcome_email', userEmail, mailOptions.subject, '-', 'sent');
  } catch (error) {
    console.error(`❌ Error enviando email de bienvenida a ${userEmail}:`, error);
    await logNotificationSent(userId, 'welcome_email', userEmail, 'Bienvenido', '-', 'failed');
  }
}

// Nueva función para enviar email de confirmación
async function sendConfirmationEmail(userEmail, userName, confirmationLink, userId = null) {
  try {
    const htmlContent = getConfirmationEmailTemplate(userName, confirmationLink);
    const mailOptions = {
      from: `"Air Gijón" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'Confirma tu cuenta en Air Gijón',
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email de confirmación enviado a ${userEmail}: ${info.messageId}`);
    if (userId) {
      await logNotificationSent(userId, 'confirmation_email', userEmail, mailOptions.subject, '-', 'sent');
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error enviando email de confirmación a ${userEmail}:`, error);
    if (userId) {
      await logNotificationSent(userId, 'confirmation_email', userEmail, 'Confirmación de cuenta', '-', 'failed');
    }
    return { success: false, error: error.message };
  }
}

// Enviar alerta de calidad del aire
async function sendAirQualityAlert(userEmail, alertData, userId) {
  const htmlContent = getAlertTemplate(alertData);
  const subject = `🚨 Alerta: ${alertData.estado} - Air Gijón`;
  
  return await sendEmail(userEmail, subject, htmlContent, userId, 'alert');
}

module.exports = {
  verifyEmailConfig,
  sendEmail,
  sendDailyPredictions,
  sendWelcomeEmail,
  sendAirQualityAlert,
  sendConfirmationEmail,
  getDailyPredictionTemplate,
  getAlertTemplate,
  getWelcomeTemplate,
  getConfirmationEmailTemplate
}; 