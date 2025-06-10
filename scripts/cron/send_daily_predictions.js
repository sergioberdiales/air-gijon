#!/usr/bin/env node

// Cargar variables de entorno
require('dotenv').config({ path: require('path').resolve(process.cwd(), 'config/.env_local') });

const { pool, getUsersForDailyPredictions } = require('../../src/database/db');
const { sendDailyPredictions } = require('../../src/services/email_service');

/**
 * Script para enviar predicciones diarias por correo
 * Se ejecuta automáticamente una vez al día (sugerido: 8:00 AM)
 */

async function getDailyPredictions() {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Obteniendo predicciones para hoy (${hoy}) y mañana (${manana})`);
    
    // Obtener predicciones de la tabla predicciones
    const result = await pool.query(`
      SELECT 
        p.fecha,
        p.valor,
        m.nombre_modelo,
        m.roc_index
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha IN ($1, $2) 
        AND p.parametro = 'pm25'
        AND m.activo = true
      ORDER BY p.fecha ASC
    `, [hoy, manana]);

    if (result.rows.length < 2) {
      console.error(`❌ No se encontraron predicciones suficientes. Encontradas: ${result.rows.length}/2`);
      return null;
    }

    const [predHoy, predManana] = result.rows;
    
    return {
      hoy: {
        fecha: predHoy.fecha,
        valor: Math.round(predHoy.valor),
        modelo: predHoy.nombre_modelo,
        roc_index: predHoy.roc_index
      },
      manana: {
        fecha: predManana.fecha,
        valor: Math.round(predManana.valor),
        modelo: predManana.nombre_modelo,
        roc_index: predManana.roc_index
      }
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo predicciones:', error);
    throw error;
  }
}

async function sendDailyPredictionEmails() {
  try {
    console.log('🌅 Iniciando envío de predicciones diarias...');
    
    // Obtener predicciones
    const predictions = await getDailyPredictions();
    if (!predictions) {
      console.log('❌ No hay predicciones disponibles. Cancelando envío.');
      return;
    }
    
    // Obtener usuarios suscritos a predicciones diarias
    const users = await getUsersForDailyPredictions('predictions');
    
    if (users.length === 0) {
      console.log('📭 No hay usuarios suscritos a predicciones diarias.');
      return;
    }
    
    console.log(`📧 Enviando a ${users.length} usuarios suscritos...`);
    
    // Formatear datos para cada usuario
    const usersWithPredictions = users.map(user => ({
      email: user.email,
      user_name: user.name,
      user_id: user.id,
      hoy: predictions.hoy,
      manana: predictions.manana,
      fecha_hoy_format: new Date(predictions.hoy.fecha).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long' 
      }),
      fecha_manana_format: new Date(predictions.manana.fecha).toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'long' 
      })
    }));
    
    // Enviar correos
    const results = await sendDailyPredictions(usersWithPredictions);
    
    // Verificar si el envío fue exitoso
    if (!results) {
      console.log('❌ Error en el servicio de email. No se pudieron enviar predicciones.');
      return;
    }
    
    // Mostrar resumen
    const exitosos = results.filter(r => r.status === 'enviado').length;
    const fallidos = results.filter(r => r.status === 'error').length;
    
    console.log(`\n📊 Resumen del envío:`);
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Fallidos: ${fallidos}`);
    console.log(`   📧 Total: ${results.length}`);
    
    if (fallidos > 0) {
      console.log('\n❌ Errores detectados:');
      results.filter(r => r.status === 'error').forEach(r => {
        console.log(`   ${r.email}: ${r.error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en el proceso de envío:', error);
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