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

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

// Función principal del cron job
async function ejecutarCronPredicciones() {
  try {
    console.log('\n🔮 INICIANDO GENERACIÓN DE PREDICCIONES...');
    
    // Importar funciones necesarias
    const { runDailyUpdateAndPredictions } = require('./promedios_predicciones');
    const { sendDailyPredictions } = require('./email_service');
    const { format } = require('date-fns');
    const { es } = require('date-fns/locale');
    const { pool, createTables, createIndexes } = require('./db');
    
    // Verificar/crear esquema de base de datos antes de continuar
    console.log('🔧 Verificando esquema de base de datos...');
    try {
      await createTables();
      await createIndexes();
      console.log('✅ Esquema de base de datos verificado/actualizado');
    } catch (schemaError) {
      console.error('⚠️ Error verificando esquema:', schemaError.message);
      // Continuar de todas formas, puede que ya exista
    }
    
    // Verificar que la tabla promedios_diarios existe con las columnas correctas
    console.log('🔍 Verificando tabla promedios_diarios...');
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'promedios_diarios' 
      AND column_name IN ('pm25_promedio', 'fecha', 'tipo', 'confianza')
      ORDER BY column_name
    `);
    
    if (tableCheck.rows.length < 4) {
      console.error('❌ ERROR: La tabla promedios_diarios no tiene las columnas requeridas');
      console.log('Columnas encontradas:', tableCheck.rows.map(r => r.column_name));
      
      // Intentar crear la tabla
      console.log('🔧 Intentando crear/actualizar tabla...');
      await createTables();
      console.log('✅ Tabla creada/actualizada');
    } else {
      console.log('✅ Tabla promedios_diarios verificada con columnas:', 
        tableCheck.rows.map(r => r.column_name).join(', '));
    }
    
    // Generar predicciones usando la función completa
    console.log('⚙️ Ejecutando actualización y generación de predicciones...');
    await runDailyUpdateAndPredictions();
    
    // Obtener las predicciones recién generadas para envío por email
    console.log('📥 Obteniendo predicciones generadas...');
    const result = await pool.query(`
      SELECT fecha, pm25_promedio, tipo, confianza
      FROM promedios_diarios 
      WHERE tipo = 'prediccion' 
      AND fecha >= CURRENT_DATE
      ORDER BY fecha ASC
      LIMIT 2
    `);
    
    if (result.rows && result.rows.length > 0) {
      const predicciones = result.rows;
      console.log(`✅ ${predicciones.length} predicciones encontradas:`);
      predicciones.forEach(pred => {
        const estado = getEstadoPM25(pred.pm25_promedio);
        console.log(`   📅 ${pred.fecha}: ${pred.pm25_promedio} µg/m³ (${estado})`);
      });
      
      // Identificar predicciones para hoy y mañana
      const hoy = new Date().toISOString().split('T')[0];
      const manana = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
      
      const prediccionHoy = predicciones.find(p => p.fecha.toISOString().split('T')[0] === hoy);
      const prediccionManana = predicciones.find(p => p.fecha.toISOString().split('T')[0] === manana);
      
      if (prediccionHoy && prediccionManana) {
        const emailData = {
          hoy: {
            fecha: format(new Date(prediccionHoy.fecha), 'dd/MM/yyyy', { locale: es }),
            valor: prediccionHoy.pm25_promedio
          },
          manana: {
            fecha: format(new Date(prediccionManana.fecha), 'dd/MM/yyyy', { locale: es }),
            valor: prediccionManana.pm25_promedio
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
      console.log('⚠️ No se encontraron predicciones generadas');
    }

    console.log('\n✅ CRON JOB COMPLETADO EXITOSAMENTE');

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