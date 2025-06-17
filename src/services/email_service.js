const nodemailer = require('nodemailer');
const { logNotificationSent, getUsersForDailyPredictions, hasAlertBeenSentForMeasurement } = require('../database/db');
const { getEstadoPM25, getColorEstado } = require('../utils/utils');



// Configuración del transporter de email
const transporter = nodemailer.createTransport({
  service: 'gmail', // o el servicio que prefieras
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // App Password para Gmail
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
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
  const logoUrl = `${frontendBaseUrl}/logos/air_gijon_logo_v1.png`;

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
          padding: 10px 20px; 
          text-align: center; 
        }
        .header img {
          max-width: 360px;
          margin-bottom: 2px;
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
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
  
  const estadoHoy = getEstadoPM25(hoy.valor);
  const estadoManana = getEstadoPM25(manana.valor);
  const colorHoy = getColorEstado(estadoHoy);
  const colorManana = getColorEstado(estadoManana);

  const commentHoy = getOmsComment(hoy.valor);
  const commentManana = getOmsComment(manana.valor);

  const content = `
    <p>Hola ${userName || 'usuario'},</p>
    <p><strong>Aquí tienes la predicción de PM2.5 (partículas en suspensión) para hoy y mañana:</strong></p>
    
    <div class="prediction-card">
      <h3>🌅 Hoy - ${fechaHoyFormat}</h3>
      <div class="metric">
        <div class="value">${hoy.valor}</div>
        <div class="unit">µg/m³ PM2.5</div>
      </div>
      <div class="quality-badge" style="background-color: ${colorHoy.color}; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin: 10px 0;">
        ${estadoHoy}
      </div>
      <p style="margin-top:8px; font-size:0.9em;">${commentHoy}</p>
    </div>

    <div class="prediction-card">
      <h3>🌄 Mañana - ${fechaMananaFormat}</h3>
      <div class="metric">
        <div class="value">${manana.valor}</div>
        <div class="unit">µg/m³ PM2.5</div>
      </div>
      <div class="quality-badge" style="background-color: ${colorManana.color}; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin: 10px 0;">
        ${estadoManana}
      </div>
      <p style="margin-top:8px; font-size:0.9em;">${commentManana}</p>
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
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';

  const comment = getOmsComment(valor);

  const content = `
    <p>Hola ${userName || 'usuario'},</p>
    
    <!-- Alerta destacada de PM2.5 -->
    <div style="background-color: #fee2e2; border: 2px solid #dc2626; padding: 25px; border-radius: 12px; margin: 25px 0; text-align: center;">
      <div style="background-color: #dc2626; color: white; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 16px; margin-bottom: 15px;">
        🚨 ALERTA PM2.5
      </div>
      <p style="font-size: 18px; font-weight: bold; margin: 10px 0; color: #dc2626;">
        Los niveles de <strong>partículas PM2.5</strong> han superado el umbral de seguridad
      </p>
      <p style="font-size: 16px; margin: 5px 0; color: #7f1d1d;">
        Estación: <strong>${estacion}</strong>
      </p>
    </div>

    <!-- Valor destacado con PM2.5 muy visible -->
    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #f8fafc; border: 3px solid ${color.color}; border-radius: 15px; padding: 25px; display: inline-block; min-width: 250px;">
        <div style="font-size: 14px; font-weight: bold; color: #64748b; margin-bottom: 5px; letter-spacing: 1px;">
          CONCENTRACIÓN ACTUAL
        </div>
        <div style="font-size: 48px; font-weight: bold; color: ${color.color}; line-height: 1; margin: 10px 0;">
          ${valor}
        </div>
        <div style="font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 15px;">
          µg/m³ <span style="background-color: ${color.color}; color: white; padding: 4px 12px; border-radius: 8px; font-size: 16px;">PM2.5</span>
        </div>
        <div style="background-color: ${color.color}; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 16px;">
          ${estado}
        </div>
      </div>
    </div>

    <!-- Información sobre PM2.5 -->
    <div style="background-color: #f1f5f9; border-left: 4px solid #0075FF; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 10px 0; color: #0052B2; font-size: 18px;">¿Qué son las partículas PM2.5?</h3>
      <p style="margin: 0; font-size: 14px; color: #475569;">
        Las PM2.5 son partículas muy pequeñas (≤2.5 micrómetros) que pueden penetrar profundamente en los pulmones y el torrente sanguíneo, representando el mayor riesgo para la salud.
      </p>
    </div>

    <p style="font-size: 16px; font-weight: 500; color: #1e293b;">${comment}</p>

    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>📅 Fecha y hora:</strong> ${new Date(fecha).toLocaleString('es-ES')}</p>
      <p style="margin: 5px 0 0 0; font-size: 13px; color: #92400e;">Esta alerta se envía como máximo una vez al día cuando PM2.5 > 50 µg/m³</p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${frontendBaseUrl}" class="button" style="font-size: 16px; padding: 15px 30px;">
        📊 Ver Evolución de PM2.5 en Tiempo Real
      </a>
    </div>
  `;

  return getBaseEmailTemplate(
    '🚨 ALERTA PM2.5 - Niveles Elevados en Gijón',
    content,
    '<p>Puedes gestionar tus <a href="' + frontendBaseUrl + '/cuenta">preferencias de notificación</a>.</p>'
  );
}

// Plantilla de bienvenida (después de confirmar)
function getWelcomeTemplate(userName) {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
  const subject = userName ? `👋 ¡Bienvenido/a a Air Gijón, ${userName}!` : '👋 ¡Bienvenido/a a Air Gijón!';
  const greeting = userName ? `¡Hola, ${userName}!` : '¡Te damos la bienvenida a Air Gijón!';

  const content = `
    <p>${greeting}</p>
    <p>¡Gracias por unirte a nuestra comunidad! Tu cuenta ha sido confirmada y ya está todo listo para que empieces a usar la aplicación.</p>
    <p>Desde ahora, podrás:</p>
    <ul style="padding-left: 20px; margin-bottom: 20px;">
      <li style="margin-bottom: 10px;">✅ Recibir <strong>predicciones diarias</strong> de PM2.5.</li>
      <li style="margin-bottom: 10px;">🚨 Obtener <strong>alertas automáticas</strong> cuando la calidad del aire cambie significativamente.</li>
      <li style="margin-bottom: 10px;">📊 Acceder al <strong>panel de control</strong> con datos en tiempo real e históricos.</li>
    </ul>
    <p>Puedes gestionar tus preferencias de notificación desde tu perfil en cualquier momento.</p>
    <div style="text-align: center; margin-top: 30px;">
      <a href="${frontendBaseUrl}" class="button">
        Ir a la aplicación
      </a>
    </div>
  `;
  
  return getBaseEmailTemplate(subject, content);
}

// Plantilla para email de confirmación de cuenta
function getConfirmationTemplate(userName, confirmationLink) {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
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

// Plantilla para email de reseteo de contraseña
function getPasswordResetTemplate(resetLink, userName) {
  console.log(`[EMAIL_SERVICE] getPasswordResetTemplate called. userName: ${userName}, resetLink: ${resetLink}`);
  const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
  const content = `
    <h2>🔑 Restablece tu Contraseña</h2>
    
    <p>Hola ${userName || 'Usuario'},</p>
    
    <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Air Gijón. Si no solicitaste esto, puedes ignorar este mensaje.</p>
    
    <p>Para continuar con el restablecimiento, haz clic en el siguiente botón:</p>
    
    <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
      <a href="${resetLink}" class="button">
        Restablecer Contraseña
      </a>
    </div>
    
    <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    
    <p>Este enlace para restablecer la contraseña expirará en 1 hora.</p>
  `;

  const emailHtml = getBaseEmailTemplate(
    'Restablece tu Contraseña - Air Gijón',
    content,
    '<p>Por seguridad, nunca compartas este enlace con nadie.</p>'
  );
  console.log(`[EMAIL_SERVICE] getPasswordResetTemplate generated HTML (first 100 chars): ${emailHtml.substring(0, 100)}...`);
  return emailHtml;
}

// Enviar email
async function sendEmail(to, subject, htmlContent, userId = null, type = 'general', measurementData = null) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ EMAIL_USER o EMAIL_PASS no están configuradas en las variables de entorno. No se pueden enviar emails.');
    return { success: false, message: "Variables de entorno de email no configuradas." };
  }

  const mailOptions = {
    from: `"Air Gijón" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: htmlContent,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado (${type}) a ${to}: ${info.messageId}`);
    // Registrar notificación si es relevante y se proporciona userId
    if (userId) {
      await logNotificationSent(userId, type, to, subject, htmlContent, 'sent', measurementData);
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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASS). No se enviarán correos de predicción.');
    return [];
  }

  const results = [];
  for (const userData of usersWithPredictions) {
    const { email, user_name, hoy, manana, fecha_hoy_format, fecha_manana_format, user_id } = userData;
    
    // Formatear fechas si es necesario (asumiendo que ya vienen formateadas o son objetos Date)
    const predictionDetails = {
      hoy: { valor: hoy.valor, modelo: hoy.modelo },
      manana: { valor: manana.valor, modelo: manana.modelo },
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
  const htmlContent = getWelcomeTemplate(userName);
  // El asunto se genera ahora dentro de getWelcomeTemplate
  const subject = userName ? `👋 ¡Bienvenido/a a Air Gijón, ${userName}!` : '👋 ¡Bienvenido/a a Air Gijón!';
  return sendEmail(userEmail, subject, htmlContent, userId, 'welcome');
}

// Nueva función para enviar email de confirmación
async function sendConfirmationEmail(userEmail, userName, confirmationLink, userId = null) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASS). No se enviará correo de confirmación.');
    return;
  }
  const htmlContent = getConfirmationTemplate(userName, confirmationLink);
  return sendEmail(userEmail, '📧 Confirma tu cuenta en Air Gijón', htmlContent, userId, 'confirmation');
}

// Enviar alerta de calidad del aire
async function sendAirQualityAlert(userEmail, userName, alertData, userId) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASS). No se enviará correo de alerta.');
    return;
  }
  
  // Preparar datos de medición para tracking
  const measurementData = {
    fecha: alertData.fecha,
    parametro: 'pm25', // Parámetro de la medición
    valor: alertData.valor,
    estacion_id: '6699' // Avenida Constitución
  };
  
  const enrichedAlertData = { ...alertData, userName };
  const htmlContent = getAlertTemplate(enrichedAlertData);
  return sendEmail(
    userEmail, 
    `🚨 ALERTA PM2.5: ${alertData.valor} µg/m³ (${alertData.estado}) - Gijón`, 
    htmlContent, 
    userId, 
    'pm25_alert', 
    measurementData
  );
}

// Enviar email de reseteo de contraseña
async function sendPasswordResetEmail(to, userName, resetLink, userId) {
  console.log(`[EMAIL_SERVICE] sendPasswordResetEmail called. To: ${to}, userName: ${userName}, userId: ${userId}, resetLink: ${resetLink}`);
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('[EMAIL_SERVICE] ❌ Faltan credenciales de email (EMAIL_USER o EMAIL_PASS). No se enviará correo de reseteo.');
    return { success: false, error: 'Missing email credentials' };
  }
  const subject = 'Restablece tu contraseña en Air Gijón';
  console.log(`[EMAIL_SERVICE] Subject: ${subject}`);
  const htmlContent = getPasswordResetTemplate(resetLink, userName);
  
  console.log(`[EMAIL_SERVICE] Attempting to send email via sendEmail function. To: ${to}, Subject: ${subject}`);
  const result = await sendEmail(to, subject, htmlContent, userId, 'password_reset');
  console.log(`[EMAIL_SERVICE] sendEmail function result for password_reset:`, result);
  return result;
}

// Plantilla para reporte de administrador
function getAdminReportTemplate(reportData) {
  const { 
    fecha, 
    totalUsuarios, 
    exitosos, 
    fallidos, 
    errores, 
    prediccionHoy, 
    prediccionManana,
    tiempoEjecucion 
  } = reportData;

  const content = `
    <h2>📊 Reporte Diario - Envío de Predicciones</h2>
    
    <p><strong>Fecha:</strong> ${fecha}</p>
    <p><strong>Tiempo de ejecución:</strong> ${tiempoEjecucion}</p>
    
    <div class="prediction-card">
      <h3>📈 Predicciones Enviadas</h3>
      <p><strong>Hoy:</strong> ${prediccionHoy.valor} µg/m³ PM2.5 (${prediccionHoy.fecha})</p>
      <p><strong>Mañana:</strong> ${prediccionManana.valor} µg/m³ PM2.5 (${prediccionManana.fecha})</p>
      <p><strong>Modelo:</strong> ${prediccionHoy.modelo}</p>
    </div>

    <div class="prediction-card">
      <h3>📧 Resultados del Envío</h3>
      <p><strong>Total usuarios suscritos:</strong> ${totalUsuarios}</p>
      <p><strong>✅ Envíos exitosos:</strong> ${exitosos}</p>
      <p><strong>❌ Envíos fallidos:</strong> ${fallidos}</p>
      <p><strong>📊 Tasa de éxito:</strong> ${totalUsuarios > 0 ? Math.round((exitosos / totalUsuarios) * 100) : 0}%</p>
    </div>

    ${errores.length > 0 ? `
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3>⚠️ Errores Detectados</h3>
      <ul>
        ${errores.map(error => `<li><strong>${error.email}:</strong> ${error.error}</li>`).join('')}
      </ul>
    </div>
    ` : '<div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;"><p><strong>✅ Sin errores detectados</strong></p></div>'}
  `;

  return getBaseEmailTemplate(
    '📊 Reporte Diario - Air Gijón Admin',
    content,
    '<p>Este es un reporte automático del sistema de predicciones diarias.</p>'
  );
}

// Enviar reporte de administrador
async function sendAdminReport(reportData) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Faltan credenciales de email. No se enviará reporte de administrador.');
    return { success: false, error: 'Missing email credentials' };
  }

  const adminEmail = 'airgijon@gmail.com';
  const htmlContent = getAdminReportTemplate(reportData);
  const subject = `📊 Reporte Diario - Predicciones ${reportData.fecha}`;
  
  try {
    const result = await sendEmail(adminEmail, subject, htmlContent, null, 'admin_report');
    console.log(`📧 Reporte de administrador enviado a ${adminEmail}`);
    return result;
  } catch (error) {
    console.error(`❌ Error enviando reporte de administrador:`, error);
    return { success: false, error: error.message };
  }
}

// Comentarios según los rangos oficiales de la OMS para PM2.5
function getOmsComment(pm25) {
  if (pm25 <= 15) {
    return 'La calidad del aire es buena (≤15 µg/m³). No se esperan riesgos para la población.';
  }
  if (pm25 <= 25) {
    return 'Calidad del aire moderada (16-25 µg/m³). Las personas sensibles deberían vigilar posibles síntomas.';
  }
  if (pm25 <= 50) {
    return 'La calidad del aire es regular (26-50 µg/m³). Se aconseja reducir actividades físicas intensas al aire libre.';
  }
  return 'La calidad del aire es mala (>50 µg/m³). Evita el ejercicio al aire libre y permanece atento a la evolución en la aplicación.';
}

module.exports = {
  verifyEmailConfig,
  sendEmail,
  sendDailyPredictions,
  sendWelcomeEmail,
  sendAirQualityAlert,
  sendConfirmationEmail,
  sendPasswordResetEmail,
  sendAdminReport,
  getDailyPredictionTemplate,
  getAlertTemplate,
  getWelcomeTemplate,
  getConfirmationTemplate,
  getPasswordResetTemplate,
  getAdminReportTemplate,
  getOmsComment
};