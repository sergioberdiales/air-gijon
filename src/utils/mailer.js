const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE || 'gmail', // p.ej., 'gmail', 'hotmail', etc.
  auth: {
    user: process.env.MAIL_USER, // tu_correo@ejemplo.com
    pass: process.env.MAIL_PASS  // tu_contraseña_o_token
  },
  // Opción para permitir conexiones auto-firmadas (para desarrollo con algunos servidores SMTP locales)
  // tls: {
  //   rejectUnauthorized: false 
  // }
});

/**
 * Envía un correo electrónico.
 * @param {string} to - Dirección de correo del destinatario.
 * @param {string} subject - Asunto del correo.
 * @param {string} text - Contenido en texto plano del correo.
 * @param {string} [html] - Contenido en HTML del correo (opcional).
 * @returns {Promise<void>}
 */
const sendNotificationEmail = async (to, subject, text, html) => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn('⚠️  Servicio de correo no configurado (MAIL_USER o MAIL_PASS no definidos). No se enviarán correos.');
    return;
  }

  const mailOptions = {
    from: process.env.MAIL_FROM || `"Air Gijón Alertas" <${process.env.MAIL_USER}>`, // "Nombre visible" <tu_correo@ejemplo.com>
    to,
    subject,
    text,
    html 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📬 Correo enviado a ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Error al enviar correo a ${to}:`, error);
    // Considerar reintentos o un sistema de colas para errores persistentes.
  }
};

module.exports = { sendNotificationEmail }; 