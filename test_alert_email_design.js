require('dotenv').config();
const fs = require('fs');

// Importar la función desde el servicio de email
const { sendAirQualityAlert } = require('./src/services/email_service');

console.log('🎨 Generando vista previa del email de alerta...');

// Datos de prueba para alerta (PM2.5 alto) 
const testAlertData = {
  valor: 65,
  estado: 'Pobre',
  estacion: 'Avenida Constitución',
  fecha: new Date(),
  userName: 'Sergio Berdiales'
};

// Función auxiliar para obtener color del estado
function getColorEstado(estado) {
  const colores = {
    'Buena': { color: '#4CAF50', background: '#E8F5E8' },
    'Moderada': { color: '#FFC107', background: '#FFF8E1' },
    'Regular': { color: '#FF9800', background: '#FFF3E0' },
    'Pobre': { color: '#F44336', background: '#FFEBEE' },
    'Muy pobre': { color: '#9C27B0', background: '#F3E5F5' }
  };
  return colores[estado] || colores['Regular'];
}

// Función auxiliar para comentarios OMS
function getOmsComment(pm25) {
  if (pm25 <= 15) {
    return "📍 <strong>Organización Mundial de la Salud (OMS):</strong> Los niveles están dentro de las directrices anuales. El aire está limpio y es seguro para actividades al aire libre.";
  } else if (pm25 <= 25) {
    return "📍 <strong>OMS:</strong> Calidad del aire moderada. Es seguro realizar actividades al aire libre, pero personas sensibles pueden considerar reducir ejercicio intenso prolongado.";
  } else if (pm25 <= 50) {
    return "📍 <strong>OMS:</strong> Calidad del aire regular. Personas con problemas cardíacos o pulmonares, adultos mayores y niños deberían limitar esfuerzos prolongados al aire libre.";
  } else {
    return "📍 <strong>OMS:</strong> Calidad del aire pobre. Se recomienda que todas las personas limiten actividades al aire libre, especialmente ejercicio intenso. Usar mascarillas puede ser beneficioso.";
  }
}

const { valor, estado, estacion, fecha, userName } = testAlertData;
const color = getColorEstado(estado);
const frontendBaseUrl = process.env.FRONTEND_URL || 'https://air-gijon-front-end.onrender.com';
const logoUrl = `${frontendBaseUrl}/logos/air_gijon_logo_v1.png`;
const comment = getOmsComment(valor);

const content = `
  <p>Hola ${userName || 'usuario'},</p>
  <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="color: #d1a000; margin-top: 0;">🚨 Alerta de Calidad del Aire</h3>
    <p><strong>Se ha detectado un nivel elevado de PM2.5 en Gijón:</strong></p>
  </div>
  
  <div class="prediction-card">
    <h3>📍 ${estacion}</h3>
    <div class="metric">
      <div class="value">${valor}</div>
      <div class="unit">µg/m³ PM2.5</div>
    </div>
    <div class="quality-badge" style="background-color: ${color.color}; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin: 10px 0;">
      Calidad: ${estado}
    </div>
    <p style="margin-top: 15px; font-size: 14px; color: #666;">
      📅 Medición del ${fecha.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}
    </p>
    <p style="margin-top:8px; font-size:0.9em;">${comment}</p>
  </div>
  
  <div style="background-color: #f0f7ff; border-left: 4px solid #0075FF; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <h4 style="color: #0052B2; margin-top: 0;">💡 Recomendaciones:</h4>
    <ul style="margin: 10px 0; padding-left: 20px;">
      <li>Limita las actividades al aire libre</li>
      <li>Mantén las ventanas cerradas</li>
      <li>Considera usar mascarilla si debes salir</li>
      <li>Personas sensibles deben extremar precauciones</li>
    </ul>
  </div>
  
  <div style="text-align: center; margin-top: 30px;">
    <a href="${frontendBaseUrl}" class="button">
      Ver datos actualizados
    </a>
  </div>
`;

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
      margin: 0; 
      padding: 20px; 
      background-color: #F0F7FF;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: #FFFFFF;
      border-radius: 12px; 
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .header { 
      background: #0075FF;
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
      color: #333333;
      line-height: 1.6;
    }
    .footer { 
      background: #f8f9fa; 
      padding: 20px; 
      text-align: center; 
      color: #666666;
      font-size: 13px;
      border-top: 1px solid #E0E0E0;
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
      background: #F0F7FF;
      border-left: 4px solid #0075FF;
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
      color: #333333;
    }
    .metric .unit {
      color: #666666;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: #0075FF;
      color: white !important;
      padding: 12px 28px;
      text-decoration: none;
      border-radius: 6px;
      margin: 15px 0;
      font-weight: 600;
      font-size: 15px;
    }
    .button:hover {
      background: #0052B2;
    }
    a {
      color: #0075FF;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Air Gijón Logo">
      <h1>🚨 Alerta de Calidad del Aire - Air Gijón</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Puedes gestionar tus <a href="${frontendBaseUrl}/cuenta">preferencias de notificación</a>.</p>
      <p>&copy; ${new Date().getFullYear()} Air Gijón. Todos los derechos reservados.<br>
      Este es un correo electrónico generado automáticamente, por favor no respondas a este mensaje.</p>
    </div>
  </div>
</body>
</html>
`;

// Guardar el HTML para poder abrirlo en el navegador
fs.writeFileSync('./preview_alert_email.html', htmlContent);

console.log('✅ Vista previa generada: preview_alert_email.html');
console.log('📧 Abre este archivo en tu navegador para ver el diseño del email de alerta');
console.log('🎯 Datos de prueba:');
console.log(`   - PM2.5: ${valor} µg/m³`);
console.log(`   - Estado: ${estado}`); 
console.log(`   - Estación: ${estacion}`);
console.log(`   - Usuario: ${userName}`);
console.log(`\n🌐 Para abrir: open ./preview_alert_email.html`); 