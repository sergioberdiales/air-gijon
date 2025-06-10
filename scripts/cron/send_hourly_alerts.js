#!/usr/bin/env node

// Cargar variables de entorno
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env_local') });

const { pool, getUsersForDailyPredictions, hasAlertBeenSentForMeasurement } = require('../../src/database/db');
const { sendAirQualityAlert } = require('../../src/services/email_service');
const { getEstadoPM25 } = require('../../src/utils/utils');

/**
 * Script para enviar alertas cuando PM2.5 > 50 µg/m³
 * Se ejecuta cada hora para monitorear datos en tiempo real
 */

const ALERT_THRESHOLD = 50; // µg/m³
const ESTACION_ID = '6699'; // Avenida Constitución

async function checkForHighPM25() {
  try {
    console.log('🔍 Verificando niveles de PM2.5...');
    
    // Obtener la última medición disponible (sin límite de tiempo)
    const result = await pool.query(`
      SELECT 
        fecha,
        valor,
        estacion_id,
        EXTRACT(EPOCH FROM (NOW() - fecha))/3600 as horas_desde_medicion
      FROM mediciones_api 
      WHERE estacion_id = $1 
        AND parametro = 'pm25'
        AND valor IS NOT NULL
      ORDER BY fecha DESC 
      LIMIT 1
    `, [ESTACION_ID]);

    if (result.rows.length === 0) {
      console.log('❌ No se encontraron mediciones de PM2.5 en la base de datos');
      return null;
    }

    const medicion = result.rows[0];
    const valor = parseFloat(medicion.valor);
    const horasDesde = Math.round(medicion.horas_desde_medicion * 10) / 10; // Redondear a 1 decimal
    
    console.log(`📊 Última medición: ${valor} µg/m³ (hace ${horasDesde} horas - ${new Date(medicion.fecha).toLocaleString('es-ES')})`);
    
    // Determinar si es alerta por valor alto o simplemente información
    const esAlerta = valor > ALERT_THRESHOLD;
    
    if (esAlerta) {
      console.log(`🚨 ALERTA: PM2.5 (${valor} µg/m³) supera el umbral de ${ALERT_THRESHOLD} µg/m³`);
    } else {
      console.log(`ℹ️ Enviando información: PM2.5 (${valor} µg/m³) - nivel normal`);
    }
    
    return {
      valor: Math.round(valor),
      estado: getEstadoPM25(valor),
      estacion: 'Avenida Constitución',
      fecha: medicion.fecha,
      horasDesde: horasDesde,
      esAlerta: esAlerta
    };
    
  } catch (error) {
    console.error('❌ Error verificando PM2.5:', error);
    throw error;
  }
}

async function sendHighPM25Alerts() {
  try {
    console.log('🔔 Iniciando verificación de alertas de PM2.5...');
    
    // Verificar si hay niveles altos
    const alertData = await checkForHighPM25();
    if (!alertData) {
      console.log('✅ No se requieren alertas en este momento');
      return;
    }
    
    // Obtener usuarios suscritos a alertas
    const users = await getUsersForDailyPredictions('alerts');
    
    if (users.length === 0) {
      console.log('📭 No hay usuarios suscritos a alertas');
      return;
    }
    
    console.log(`👥 Verificando ${users.length} usuarios suscritos...`);
    
    let alertsSent = 0;
    let alertsSkipped = 0;
    
    // Enviar alertas a todos los usuarios (sin restricción diaria)
    for (const user of users) {
      try {
        // RESTRICCIÓN DIARIA TEMPORALMENTE DESACTIVADA
        // const alreadyReceived = await hasUserReceivedAlertToday(user.id);
        // 
        // if (alreadyReceived) {
        //   console.log(`⏩ Usuario ${user.email}: Ya recibió alerta hoy (omitiendo)`);
        //   alertsSkipped++;
        //   continue;
        // }
        
        // Verificar si ya se envió alerta para esta medición específica
        const alreadySent = await hasAlertBeenSentForMeasurement(user.id, alertData.fecha, ESTACION_ID, 'pm25');
        if (alreadySent) {
          console.log(`⏩ Usuario ${user.email}: Ya recibió alerta para esta medición PM2.5 (omitiendo)`);
          alertsSkipped++;
          continue;
        }
        
        // Enviar alerta
        await sendAirQualityAlert(user.email, user.name, alertData, user.id);
        console.log(`📧 Usuario ${user.email}: Alerta enviada`);
        alertsSent++;
        
      } catch (error) {
        console.error(`❌ Error enviando alerta a ${user.email}:`, error);
      }
    }
    
    console.log(`\n📊 Resumen de alertas:`);
    console.log(`   📧 Enviadas: ${alertsSent}`);
    console.log(`   ⏩ Omitidas (ya recibidas hoy): ${alertsSkipped}`);
    console.log(`   👥 Total usuarios: ${users.length}`);
    
  } catch (error) {
    console.error('❌ Error en el proceso de alertas:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  sendHighPM25Alerts()
    .then(() => {
      console.log('✅ Proceso de alertas completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error en el proceso:', error);
      process.exit(1);
    });
}

module.exports = { sendHighPM25Alerts }; 