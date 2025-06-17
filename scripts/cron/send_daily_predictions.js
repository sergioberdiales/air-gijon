#!/usr/bin/env node

// Cargar variables de entorno
require('dotenv').config({ path: require('path').resolve(process.cwd(), 'config/.env_local') });

const { pool, getUsersForDailyPredictions } = require('../../src/database/db');
const { sendDailyPredictions, sendAdminReport } = require('../../src/services/email_service');

/**
 * Script para enviar predicciones diarias por correo
 * Se ejecuta automáticamente una vez al día (sugerido: 8:00 AM)
 */

async function getDailyPredictions() {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Obteniendo predicciones para hoy (${hoy}) y mañana (${manana})`);
    
    // Obtener predicciones usando horizonte_dias para asegurar el mapeo correcto
    const result = await pool.query(`
      SELECT 
        p.fecha,
        p.valor,
        p.horizonte_dias,
        m.nombre_modelo
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha >= $1 
        AND p.parametro = 'pm25'
        AND m.activo = true
        AND p.horizonte_dias IN (0, 1)
      ORDER BY p.horizonte_dias ASC
    `, [hoy]);

    if (result.rows.length < 2) {
      console.error(`❌ No se encontraron predicciones suficientes. Encontradas: ${result.rows.length}/2`);
      result.rows.forEach(row => {
        console.log(`   - Fecha: ${row.fecha}, Horizonte: ${row.horizonte_dias}, Valor: ${row.valor}`);
      });
      return null;
    }

    // Mapear correctamente basándose en horizonte_dias, no en fecha
    const predHoy = result.rows.find(row => row.horizonte_dias === 0);
    const predManana = result.rows.find(row => row.horizonte_dias === 1);
    
    if (!predHoy || !predManana) {
      console.error('❌ No se encontraron predicciones para ambos horizontes');
      console.log('Predicciones disponibles:');
      result.rows.forEach(row => {
        console.log(`   - Horizonte ${row.horizonte_dias}: ${row.fecha} = ${row.valor} µg/m³`);
      });
      return null;
    }
    
    return {
      hoy: {
        fecha: predHoy.fecha,
        valor: Math.round(predHoy.valor),
        modelo: predHoy.nombre_modelo,
        horizonte_dias: predHoy.horizonte_dias
      },
      manana: {
        fecha: predManana.fecha,
        valor: Math.round(predManana.valor),
        modelo: predManana.nombre_modelo,
        horizonte_dias: predManana.horizonte_dias
      }
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo predicciones:', error);
    throw error;
  }
}

async function sendDailyPredictionEmails() {
  const startTime = Date.now();
  
  try {
    console.log('🌅 Iniciando envío de predicciones diarias...');
    
    // Obtener predicciones
    const predictions = await getDailyPredictions();
    if (!predictions) {
      console.log('❌ No hay predicciones disponibles. Cancelando envío.');
      
      // Enviar reporte de error al administrador
      const errorReportData = {
        fecha: new Date().toLocaleDateString('es-ES'),
        totalUsuarios: 0,
        exitosos: 0,
        fallidos: 0,
        errores: [{ email: 'Sistema', error: 'No hay predicciones disponibles' }],
        prediccionHoy: { valor: 'N/A', fecha: 'N/A', modelo: 'N/A' },
        prediccionManana: { valor: 'N/A', fecha: 'N/A', modelo: 'N/A' },
        tiempoEjecucion: `${Math.round((Date.now() - startTime) / 1000)}s`
      };
      
      await sendAdminReport(errorReportData);
      return;
    }
    
    // Obtener usuarios suscritos a predicciones diarias
    const users = await getUsersForDailyPredictions('predictions');
    
    if (users.length === 0) {
      console.log('📭 No hay usuarios suscritos a predicciones diarias.');
      
      // Enviar reporte al administrador indicando que no hay usuarios
      const noUsersReportData = {
        fecha: new Date().toLocaleDateString('es-ES'),
        totalUsuarios: 0,
        exitosos: 0,
        fallidos: 0,
        errores: [],
        prediccionHoy: predictions.hoy,
        prediccionManana: predictions.manana,
        tiempoEjecucion: `${Math.round((Date.now() - startTime) / 1000)}s`
      };
      
      await sendAdminReport(noUsersReportData);
      return;
    }
    
    console.log(`📧 Enviando a ${users.length} usuarios suscritos...`);
    
    // Formatear datos para cada usuario
    const usersWithPredictions = users.map(user => {
      // Asegurar que las fechas son correctas: hoy y mañana
      const fechaHoy = new Date();
      const fechaManana = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      return {
        email: user.email,
        user_name: user.name,
        user_id: user.id,
        hoy: predictions.hoy,
        manana: predictions.manana,
        fecha_hoy_format: fechaHoy.toLocaleDateString('es-ES', { 
          day: 'numeric', 
          month: 'long' 
        }),
        fecha_manana_format: fechaManana.toLocaleDateString('es-ES', { 
          day: 'numeric', 
          month: 'long' 
        })
      };
    });
    
    // Enviar correos
    const results = await sendDailyPredictions(usersWithPredictions);
    
    // Verificar si el envío fue exitoso
    if (!results) {
      console.log('❌ Error en el servicio de email. No se pudieron enviar predicciones.');
      
      // Enviar reporte de error al administrador
      const errorReportData = {
        fecha: new Date().toLocaleDateString('es-ES'),
        totalUsuarios: users.length,
        exitosos: 0,
        fallidos: users.length,
        errores: [{ email: 'Sistema', error: 'Error en el servicio de email' }],
        prediccionHoy: predictions.hoy,
        prediccionManana: predictions.manana,
        tiempoEjecucion: `${Math.round((Date.now() - startTime) / 1000)}s`
      };
      
      await sendAdminReport(errorReportData);
      return;
    }
    
    // Procesar resultados
    const exitosos = results.filter(r => r.status === 'enviado').length;
    const fallidos = results.filter(r => r.status === 'error').length;
    const errores = results.filter(r => r.status === 'error');
    
    // Mostrar resumen en consola
    console.log(`\n📊 Resumen del envío:`);
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Fallidos: ${fallidos}`);
    console.log(`   📧 Total: ${results.length}`);
    
    if (fallidos > 0) {
      console.log('\n❌ Errores detectados:');
      errores.forEach(r => {
        console.log(`   ${r.email}: ${r.error}`);
      });
    }
    
    // Preparar y enviar reporte al administrador
    const reportData = {
      fecha: new Date().toLocaleDateString('es-ES'),
      totalUsuarios: users.length,
      exitosos: exitosos,
      fallidos: fallidos,
      errores: errores,
      prediccionHoy: predictions.hoy,
      prediccionManana: predictions.manana,
      tiempoEjecucion: `${Math.round((Date.now() - startTime) / 1000)}s`
    };
    
    console.log('📧 Enviando reporte al administrador...');
    await sendAdminReport(reportData);
    console.log('✅ Reporte de administrador enviado');
    
  } catch (error) {
    console.error('❌ Error en el proceso de envío:', error);
    
    // Enviar reporte de error crítico al administrador
    const criticalErrorReportData = {
      fecha: new Date().toLocaleDateString('es-ES'),
      totalUsuarios: 'Error',
      exitosos: 0,
      fallidos: 'Error',
      errores: [{ email: 'Sistema', error: `Error crítico: ${error.message}` }],
      prediccionHoy: { valor: 'Error', fecha: 'Error', modelo: 'Error' },
      prediccionManana: { valor: 'Error', fecha: 'Error', modelo: 'Error' },
      tiempoEjecucion: `${Math.round((Date.now() - startTime) / 1000)}s`
    };
    
    try {
      await sendAdminReport(criticalErrorReportData);
    } catch (reportError) {
      console.error('❌ Error enviando reporte de error crítico:', reportError);
    }
    
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  sendDailyPredictionEmails()
    .then(() => {
      console.log('✅ Proceso de predicciones diarias completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error en el proceso:', error);
      process.exit(1);
    });
}

module.exports = { sendDailyPredictionEmails }; 