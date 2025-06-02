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
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-frontend.onrender.com'; // Asegúrate que esta sea la URL correcta de tu frontend en Render
  const logoUrl = `${frontendBaseUrl}/src/components/logos/air_gijon_logo_v1.png`;

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { 
          font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0; 
          padding: 20px; 
          background-color: #F0F7FF; /* Azul Claro */
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: #FFFFFF; /* Blanco */
          border-radius: 12px; 
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .header { 
          background: #0075FF; /* Azul Primario */
          color: white; 
          padding: 25px 20px; 
          text-align: center; 
        }
        .header img {
          max-width: 180px;
          margin-bottom: 10px;
        }
        .header h1 { 
          margin: 0; 
          font-size: 26px; 
          font-weight: 700;
        }
        .content { 
          padding: 30px 25px; 
          color: #333333; /* Gris Oscuro */
          line-height: 1.6;
        }
        .content h2 {
          color: #0052B2; /* Azul Oscuro */
          font-size: 22px;
        }
        .content p {
          margin-bottom: 15px;
        }
        .footer { 
          background: #f8f9fa; 
          padding: 20px; 
          text-align: center; 
          color: #666666; /* Gris Medio */
          font-size: 13px;
          border-top: 1px solid #E0E0E0; /* Gris Claro */
        }
        .quality-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          color: white;
          font-weight: 600;
          margin: 10px 0;
          font-size: 14px;
        }
        .prediction-card {
          background: #F0F7FF; /* Azul Claro */
          border-left: 4px solid #0075FF; /* Azul Primario */
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .metric {
          text-align: center;
          margin: 20px 0;
        }
        .metric .value {
          font-size: 34px;
          font-weight: bold;
          color: #333333; /* Gris Oscuro */
        }
        .metric .unit {
          color: #666666; /* Gris Medio */
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background: #0075FF; /* Azul Primario */
          color: white !important; /* Importante para asegurar color de texto sobre email clients */
          padding: 12px 28px;
          text-decoration: none;
          border-radius: 6px;
          margin: 15px 0;
          font-weight: 600;
          font-size: 15px;
        }
        .button:hover {
          background: #0052B2; /* Azul Oscuro */
        }
        a {
          color: #0075FF; /* Azul Primario */
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Air Gijón Logo">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          ${footerText}
          <p>&copy; ${new Date().getFullYear()} Air Gijón. Todos los derechos reservados.<br>
          Este es un correo electrónico generado automáticamente, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Plantilla para predicción diaria
function getDailyPredictionTemplate(predictionData) {
  const { hoy, manana, fechaHoyFormat, fechaMananaFormat, userName } = predictionData;
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-frontend.onrender.com';
  
  const estadoHoy = getEstadoPM25(hoy.valor);
  const estadoManana = getEstadoPM25(manana.valor);
  const colorHoy = getColorEstado(estadoHoy);
  const colorManana = getColorEstado(estadoManana);

  const content = `
    <p>Hola ${userName || 'usuario'},</p>
    <p>Aquí tienes la predicción de calidad del aire para hoy y mañana:</p>
    
    <div class="prediction-card">
      <h3>🌅 Hoy - ${fechaHoyFormat}</h3>
      <div class="metric">
        <div class="value">${hoy.valor}</div>
        <div class="unit">µg/m³ PM2.5</div>
      </div>
      <div class="quality-badge" style="background-color: ${colorHoy};">
        ${estadoHoy}
      </div>
      ${hoy.modelo ? `<p style="font-size:0.9em; color:#666;"><em>Modelo: ${hoy.modelo} (Confianza: ${hoy.roc_index ? (hoy.roc_index * 100).toFixed(0) + '%' : 'N/A'})</em></p>` : ''}
    </div>

    <div class="prediction-card">
      <h3>🌄 Mañana - ${fechaMananaFormat}</h3>
      <div class="metric">
        <div class="value">${manana.valor}</div>
        <div class="unit">µg/m³ PM2.5</div>
      </div>
      <div class="quality-badge" style="background-color: ${colorManana};">
        ${estadoManana}
      </div>
      ${manana.modelo ? `<p style="font-size:0.9em; color:#666;"><em>Modelo: ${manana.modelo} (Confianza: ${manana.roc_index ? (manana.roc_index * 100).toFixed(0) + '%' : 'N/A'})</em></p>` : ''}
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${frontendBaseUrl}" class="button">
        Ver datos en la web
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    '🌤️ Predicción Diaria - Air Gijón',
    content,
    '<p>Puedes gestionar tus <a href="' + frontendBaseUrl + '/cuenta">preferencias de notificación</a>.</p>'
  );
}

// Plantilla para alerta de calidad del aire
function getAlertTemplate(alertData) {
  const { valor, estado, estacion, fecha, userName } = alertData;
  const color = getColorEstado(estado);
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-frontend.onrender.com';

  const content = `
    <p>Hola ${userName || 'usuario'},</p>
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Se ha detectado un cambio significativo en la calidad del aire en la estación ${estacion}:</strong></p>
    </div>

    <div class="metric">
      <div class="value">${valor}</div>
      <div class="unit">µg/m³ PM2.5</div>
    </div>
    
    <div class="quality-badge" style="background-color: ${color};">
      ${estado}
    </div>

    <p><strong>Estación:</strong> ${estacion}</p>
    <p><strong>Fecha y hora:</strong> ${new Date(fecha).toLocaleString('es-ES')}</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${frontendBaseUrl}" class="button">
        Ver Detalles en la Web
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    '🚨 Alerta de Calidad del Aire - Air Gijón',
    content,
    '<p>Puedes gestionar tus <a href="' + frontendBaseUrl + '/cuenta">preferencias de notificación</a>.</p>'
  );
}

// Plantilla de bienvenida
function getWelcomeTemplate(userName) {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-frontend.onrender.com';
  const content = `
    <h2>👋 ¡Te damos la bienvenida a Air Gijón!</h2>
    
    <p>Hola ${userName || 'Usuario'},</p>
    
    <p>Gracias por registrarte en nuestro sistema de monitoreo de calidad del aire. Para completar tu registro y empezar a recibir notificaciones, por favor, confirma tu dirección de correo electrónico haciendo clic en el enlace que te hemos enviado en un mensaje separado.</p>
    
    <p>Una vez confirmado, podrás:</p>
    
    <ul>
      <li>📅 Recibir <strong>predicciones diarias</strong> de PM2.5</li>
      <li>🚨 Obtener <strong>alertas automáticas</strong> cuando la calidad del aire cambie significativamente</li>
      <li>📊 Acceder al <strong>panel de control</strong> con datos en tiempo real e históricos</li>
    </ul>
    
    <p>Puedes gestionar tus preferencias de notificación desde tu perfil una vez hayas confirmado tu correo y hayas iniciado sesión.</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${frontendBaseUrl}" class="button">
        Ir a la aplicación
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    '👋 Bienvenido/a a Air Gijón',
    content,
    '<p>¡Gracias por unirte!</p>'
  );
}

// Plantilla para email de confirmación de cuenta
function getConfirmationTemplate(userName, confirmationLink) {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-frontend.onrender.com';
  const content = `
    <h2>✅ Confirma tu Correo Electrónico</h2>
    
    <p>Hola ${userName || 'Usuario'},</p>
    
    <p>Gracias por registrarte en Air Gijón. Por favor, haz clic en el siguiente botón para confirmar tu dirección de correo electrónico y activar tu cuenta:</p>
    
    <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
      <a href="${confirmationLink}" class="button">
        Confirmar Correo Electrónico
      </a>
    </div>
    
    <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
    <p><a href="${confirmationLink}">${confirmationLink}</a></p>
    
    <p>Si no te registraste en Air Gijón, por favor ignora este mensaje.</p>
  `;

  return getBaseEmailTemplate(
    '📧 Confirmación de Correo - Air Gijón',
    content,
    '<p>Este enlace de confirmación expirará en 24 horas.</p>'
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
async function sendDailyPredictions(usersWithPredictions) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASSWORD). No se enviarán correos de predicción.');
    return;
  }

  const results = [];
  for (const userData of usersWithPredictions) {
    const { email, user_name, hoy, manana, fecha_hoy_format, fecha_manana_format, user_id } = userData;
    
    // Formatear fechas si es necesario (asumiendo que ya vienen formateadas o son objetos Date)
    const predictionDetails = {
      hoy: { valor: hoy.valor, modelo: hoy.modelo, roc_index: hoy.roc_index },
      manana: { valor: manana.valor, modelo: manana.modelo, roc_index: manana.roc_index },
      fechaHoyFormat: fecha_hoy_format || new Date(hoy.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
      fechaMananaFormat: fecha_manana_format || new Date(manana.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
      userName: user_name
    };
    
    const htmlContent = getDailyPredictionTemplate(predictionDetails);
    try {
      await sendEmail(email, '🌤️ Predicción Diaria de Calidad del Aire - Air Gijón', htmlContent, user_id, 'daily_prediction');
      results.push({ email, status: 'enviado' });
    } catch (error) {
      console.error(`Error enviando predicción diaria a ${email}:`, error);
      results.push({ email, status: 'error', error: error.message });
    }
  }
  return results;
}

// Enviar email de bienvenida
async function sendWelcomeEmail(userEmail, userName, userId) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASSWORD). No se enviará correo de bienvenida.');
    return;
  }
  const htmlContent = getWelcomeTemplate(userName);
  return sendEmail(userEmail, `👋 ¡Bienvenido/a a Air Gijón, ${userName}!`, htmlContent, userId, 'welcome');
}

// Nueva función para enviar email de confirmación
async function sendConfirmationEmail(userEmail, userName, confirmationLink, userId = null) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASSWORD). No se enviará correo de confirmación.');
    return;
  }
  const htmlContent = getConfirmationTemplate(userName, confirmationLink);
  return sendEmail(userEmail, '📧 Confirma tu cuenta en Air Gijón', htmlContent, userId, 'confirmation');
}

// Enviar alerta de calidad del aire
async function sendAirQualityAlert(userEmail, userName, alertData, userId) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASSWORD). No se enviará correo de alerta.');
    return;
  }
  const enrichedAlertData = { ...alertData, userName };
  const htmlContent = getAlertTemplate(enrichedAlertData);
  return sendEmail(userEmail, `🚨 Alerta de Calidad del Aire: ${alertData.estado} en ${alertData.estacion}`, htmlContent, userId, 'quality_alert');
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
  getConfirmationTemplate
}; 