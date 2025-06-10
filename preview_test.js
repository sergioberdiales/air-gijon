console.log('🎨 Generando vista previa final...');

const fs = require('fs');
const { Buffer } = require('buffer');

// --- Iconos SVG (mismo set que la app, coloreados para el email) ---

// Rojo para alertas
const alertIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#F44336" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;

// Azul corporativo para iconos de información
const stationIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0052B2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16"/><path d="M2 10h20"/><path d="M6 10v12"/><path d="M18 10v12"/><path d="M14 22V10L12 8 10 10v12"/><path d="m18 5-4-3-4 3"/><path d="M10 5H6v5h4V5Z"/><path d="M18 5h-4v5h4V5Z"/></svg>`;
const infoIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0052B2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

// Gris para iconos secundarios
const clockIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// --- Función para codificar en Base64 y crear un Data URI ---
const toBase64 = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 Alerta de Calidad del Aire - Air Gijón</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { 
      font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; padding: 20px; background-color: #F0F7FF;
    }
    .container { 
      max-width: 600px; margin: 0 auto; background: #FFFFFF;
      border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: #0075FF; color: white; padding: 20px; text-align: center;
    }
    .header img.logo { max-width: 200px; margin-bottom: 15px; }
    .header .title-container { display: flex; align-items: center; justify-content: center; }
    .header .title-container img.icon { width: 26px; height: 26px; margin-right: 12px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 25px; color: #333333; line-height: 1.6; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666666; font-size: 13px; border-top: 1px solid #E0E0E0; }
    
    .card { border: 1px solid #E0E0E0; background: #FFFFFF; border-radius: 8px; margin: 20px 0; }
    .card .card-title { display: flex; align-items: center; background: #F0F7FF; color: #0052B2; padding: 15px; border-bottom: 1px solid #E0E0E0; }
    .card .card-title img.icon { width: 22px; height: 22px; margin-right: 10px; }
    .card .card-title h3 { margin: 0; font-size: 18px; }
    .card .card-content { padding: 20px; }
    
    .metric { text-align: center; margin: 10px 0 20px 0; }
    .metric .value { font-size: 38px; font-weight: bold; color: #333333; }
    .metric .unit { color: #666666; font-size: 14px; }
    .button { display: inline-block; background: #0075FF; color: white !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-weight: 600; font-size: 15px; }
    a { color: #0075FF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://air-gijon-front-end.onrender.com/logos/air_gijon_logo_v1.png" alt="Air Gijón Logo" class="logo">
      <div class="title-container">
        <img src="${toBase64(alertIconSvg)}" class="icon" alt="Alerta Icono" />
        <h1>Alerta de Calidad del Aire</h1>
      </div>
    </div>
    <div class="content">
      <p style="font-size: 16px;">Hola Sergio Berdiales,</p>
      <p style="margin-top: 0;">Se ha detectado un nivel elevado de PM2.5 en Gijón y te enviamos esta alerta con los detalles y recomendaciones.</p>
      
      <div class="card">
        <div class="card-title">
            <img src="${toBase64(stationIconSvg)}" class="icon" alt="Estación Icono" />
            <h3>Avenida Constitución</h3>
        </div>
        <div class="card-content">
            <div class="metric">
              <div class="value">65</div>
              <div class="unit">µg/m³ PM2.5</div>
            </div>
            <div style="text-align: center;">
              <div style="background-color: #F44336; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin: 10px 0;">
                Calidad del Aire: Pobre
              </div>
            </div>
            <p style="margin-top: 15px; font-size: 14px; color: #666; text-align: center; display: flex; align-items: center; justify-content: center;">
                <img src="${toBase64(clockIconSvg)}" class="icon" alt="Fecha Icono" style="width: 16px; height: 16px; margin-right: 6px;" />
                Medición del 10 de junio de 2025, 13:09
            </p>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">
            <img src="${toBase64(infoIconSvg)}" class="icon" alt="Info Icono" />
            <h3>Recomendaciones de la OMS</h3>
        </div>
        <div class="card-content">
            <p style="margin:0;">Para niveles de PM2.5 superiores a 50 µg/m³, la OMS recomienda que **todas las personas limiten actividades al aire libre**, especialmente el ejercicio intenso. Considera el uso de mascarillas si necesitas salir.</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="https://air-gijon-front-end.onrender.com" class="button">Ver datos actualizados</a>
      </div>
    </div>
    <div class="footer">
      <p>Puedes gestionar tus <a href="https://air-gijon-front-end.onrender.com/cuenta">preferencias de notificación</a>.</p>
      <p>&copy; 2025 Air Gijón. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('./preview_alert_email.html', htmlContent);
console.log('✅ Vista previa final generada: preview_alert_email.html');
console.log('🎨 Cambios aplicados:');
console.log('   • Estructura de header corregida para coincidir con la imagen.');
console.log('   • Iconos SVG consistentes con la app, incrustados en el email.');
console.log('   • Diseño de tarjetas limpio y profesional.');
console.log('🌐 URL local: file://' + process.cwd() + '/preview_alert_email.html'); 