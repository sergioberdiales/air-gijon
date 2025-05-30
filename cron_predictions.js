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
    
    // Verificar si la tabla promedios_diarios existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'promedios_diarios'
      );
    `);
    
    let hasPm25Promedio = false;
    let hasPromedioPm10 = false;
    
    if (!tableExists.rows[0].exists) {
      console.log('⚠️ Tabla promedios_diarios no existe. Creando...');
      await createTables();
      await createIndexes();
      console.log('✅ Tabla promedios_diarios creada exitosamente');
      hasPm25Promedio = true; // La tabla nueva tiene pm25_promedio
    } else {
      console.log('✅ Tabla promedios_diarios ya existe');
      
      // Mostrar TODAS las columnas que existen para debug
      const allColumns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'promedios_diarios'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Columnas existentes en promedios_diarios:');
      allColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
      
      // Verificar que tenga las columnas necesarias
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'promedios_diarios' 
        AND column_name IN ('pm25_promedio', 'promedio_pm10', 'fecha', 'tipo', 'confianza')
      `);
      
      console.log(`✅ Columnas verificadas: ${columns.rows.map(r => r.column_name).join(', ')}`);
      
      // Verificar si existe pm25_promedio o promedio_pm10
      hasPm25Promedio = columns.rows.some(r => r.column_name === 'pm25_promedio');
      hasPromedioPm10 = columns.rows.some(r => r.column_name === 'promedio_pm10');
      
      console.log(`🔍 pm25_promedio existe: ${hasPm25Promedio}`);
      console.log(`🔍 promedio_pm10 existe: ${hasPromedioPm10}`);
      
      if (!hasPm25Promedio && hasPromedioPm10) {
        console.log('⚠️ ESQUEMA INCONSISTENTE: Usando promedio_pm10 en lugar de pm25_promedio');
      }
      
      if (columns.rows.length < 3) {
        console.log('⚠️ Faltan columnas básicas. Recreando tabla...');
        await createTables();
        console.log('✅ Tabla actualizada con todas las columnas');
        hasPm25Promedio = true; // Después de recrear, tendrá pm25_promedio
      }
    }
    
    // Generar predicciones usando la función completa
    console.log('⚙️ Ejecutando actualización y generación de predicciones...');
    await runDailyUpdateAndPredictions();
    
    // Obtener las predicciones recién generadas para envío por email
    console.log('📥 Obteniendo predicciones generadas...');
    
    // Usar la columna correcta según el esquema existente
    const columnName = hasPm25Promedio ? 'pm25_promedio' : 'promedio_pm10';
    console.log(`🔍 Usando columna: ${columnName}`);
    
    const result = await pool.query(`
      SELECT fecha, ${columnName} as valor_pm, tipo, confianza
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
        const estado = getEstadoPM25(pred.valor_pm);
        console.log(`   📅 ${pred.fecha}: ${pred.valor_pm} µg/m³ (${estado})`);
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
            valor: prediccionHoy.valor_pm
          },
          manana: {
            fecha: format(new Date(prediccionManana.fecha), 'dd/MM/yyyy', { locale: es }),
            valor: prediccionManana.valor_pm
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