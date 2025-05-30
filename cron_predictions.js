#!/usr/bin/env node

// Script para cron job de predicciones diarias en Render
// Se ejecuta diariamente a las 6:00 AM para generar predicciones de PM2.5

console.log('🔮 CRON JOB - Predicciones Air Gijón - Iniciando...');
console.log(`Timestamp: ${new Date().toISOString()}`);

// Verificaciones iniciales
console.log('\n🔍 VERIFICACIONES INICIALES:');
console.log(`Node.js: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Configurada' : 'NO CONFIGURADA'}`);

// Verificar variables críticas
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR CRÍTICO: DATABASE_URL no está configurada');
  console.error('💡 SOLUCIÓN: Configurar DATABASE_URL en las variables de entorno del cron job');
  process.exit(1);
}

// Función principal del cron job
async function ejecutarCronPredicciones() {
  try {
    console.log('\n🔮 INICIANDO GENERACIÓN DE PREDICCIONES...');
    
    // Importar funciones necesarias
    const { insertarPredicciones } = require('./promedios_predicciones');
    const { sendDailyPredictions } = require('./email_service');
    const { format } = require('date-fns');
    const { es } = require('date-fns/locale');
    
    // Generar predicciones
    console.log('⚙️ Generando predicciones de PM2.5...');
    const resultados = await insertarPredicciones();
    
    if (resultados && resultados.length > 0) {
      console.log(`✅ ${resultados.length} predicciones generadas exitosamente:`);
      resultados.forEach(pred => {
        console.log(`   📅 ${pred.fecha}: ${pred.valor} µg/m³ (${pred.estado})`);
      });
      
      // Preparar datos para email
      const hoy = resultados.find(p => p.tipo === 'prediccion' && 
        new Date(p.fecha).toDateString() === new Date().toDateString());
      const manana = resultados.find(p => p.tipo === 'prediccion' && 
        new Date(p.fecha).getTime() === new Date(Date.now() + 24*60*60*1000).setHours(0,0,0,0));
      
      if (hoy && manana) {
        const emailData = {
          hoy: {
            fecha: format(new Date(hoy.fecha), 'dd/MM/yyyy', { locale: es }),
            valor: hoy.valor
          },
          manana: {
            fecha: format(new Date(manana.fecha), 'dd/MM/yyyy', { locale: es }),
            valor: manana.valor
          },
          fecha: format(new Date(), 'dd \'de\' MMMM, yyyy', { locale: es })
        };
        
        // Enviar emails a usuarios suscritos
        console.log('\n📧 ENVIANDO PREDICCIONES POR EMAIL...');
        try {
          const emailResults = await sendDailyPredictions(emailData);
          console.log(`✅ Emails enviados: ${emailResults.sent} exitosos, ${emailResults.failed} fallidos`);
          
          if (emailResults.errors.length > 0) {
            console.log('❌ Errores en envío de emails:');
            emailResults.errors.forEach(error => {
              console.log(`   ${error.email}: ${error.error}`);
            });
          }
        } catch (emailError) {
          console.error('❌ Error enviando emails:', emailError.message);
          // No detener el proceso por errores de email
        }
      } else {
        console.log('⚠️ No se encontraron predicciones para hoy y mañana para envío de emails');
      }
    } else {
      console.log('⚠️ No se generaron predicciones');
    }

    // ... existing verification code ...

  } catch (error) {
    console.error('❌ ERROR EN CRON JOB:', error);
    console.error('📍 Stack trace:', error.stack);
    
    // Estadísticas de error
    console.log('\n📊 ESTADÍSTICAS DE ERROR:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    
    process.exit(1);
  }
}

// Manejo de señales del sistema
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM recibido, cerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT recibido, cerrando...');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// Ejecutar
ejecutarCronPredicciones(); 