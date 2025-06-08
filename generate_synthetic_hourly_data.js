require('dotenv').config({ path: './.env_local' });
const { pool } = require('./db');

/**
 * Script para generar datos sintéticos horarios de PM2.5 para el día 2025-06-04
 * Incluye algunos registros faltantes para probar el algoritmo de interpolación
 */

const TARGET_DATE = '2025-06-04';
const ESTACION_ID = '6699'; // Avenida Constitución
const PARAMETRO = 'pm25';

/**
 * Genera un valor sintético de PM2.5 basado en patrones típicos diarios
 * @param {number} hora - Hora del día (0-23)
 * @returns {number} - Valor de PM2.5 en µg/m³
 */
function generateRealisticPM25(hora) {
  // Patrón típico: valores más altos en horas punta (7-9h y 18-21h)
  // y más bajos durante la madrugada (2-5h)
  
  let baseValue = 25; // Valor base
  let variation = 0;
  
  // Patrón diario
  if (hora >= 2 && hora <= 5) {
    // Madrugada: valores más bajos
    variation = -8 + Math.random() * 4; // Entre -8 y -4
  } else if (hora >= 7 && hora <= 9) {
    // Hora punta mañana: valores más altos
    variation = 5 + Math.random() * 10; // Entre 5 y 15
  } else if (hora >= 18 && hora <= 21) {
    // Hora punta tarde: valores más altos
    variation = 8 + Math.random() * 12; // Entre 8 y 20
  } else {
    // Resto del día: variación normal
    variation = -5 + Math.random() * 10; // Entre -5 y 5
  }
  
  // Añadir ruido aleatorio
  const noise = -3 + Math.random() * 6; // Entre -3 y 3
  
  const finalValue = baseValue + variation + noise;
  
  // Asegurar que el valor esté en un rango realista (5-80 µg/m³)
  return Math.max(5, Math.min(80, Math.round(finalValue * 100) / 100));
}

async function generateSyntheticData() {
  try {
    console.log(`🔄 Generando datos sintéticos horarios para ${TARGET_DATE}...`);
    
    // Verificar si ya existen datos para esta fecha
    const existingData = await pool.query(`
      SELECT COUNT(*) as count 
      FROM mediciones_api 
      WHERE DATE(fecha) = $1 AND estacion_id = $2 AND parametro = $3
    `, [TARGET_DATE, ESTACION_ID, PARAMETRO]);
    
    if (existingData.rows[0].count > 0) {
      console.log(`⚠️ Ya existen ${existingData.rows[0].count} registros para ${TARGET_DATE}`);
      console.log('¿Deseas continuar? (Esto puede crear duplicados)');
      // En producción, podrías salir aquí o limpiar primero
    }
    
    const records = [];
    
    // Generar 24 horas de datos con algunos gaps
    const missingHours = [5, 14, 17, 18]; // Horas que faltarán para probar interpolación
    
    for (let hora = 0; hora < 24; hora++) {
      const isMissing = missingHours.includes(hora);
      
      if (!isMissing) {
        const fecha = new Date(`${TARGET_DATE}T${hora.toString().padStart(2, '0')}:00:00`);
        const valor = generateRealisticPM25(hora);
        
        records.push({
          fecha,
          valor,
          hora
        });
      } else {
        console.log(`⏳ Gap simulado en hora ${hora}:00`);
      }
    }
    
    console.log(`📊 Datos generados:`);
    console.log(`   - Registros válidos: ${records.length}/24`);
    console.log(`   - Gaps simulados: ${missingHours.length} (horas: ${missingHours.join(', ')})`);
    
    // Mostrar preview de los datos
    console.log('\n📋 Preview de datos generados:');
    records.slice(0, 5).forEach(record => {
      console.log(`   ${record.hora.toString().padStart(2, '0')}:00 → ${record.valor} µg/m³`);
    });
    if (records.length > 5) {
      console.log(`   ... y ${records.length - 5} registros más`);
    }
    
    // Insertar en la base de datos
    console.log('\n🔄 Insertando en mediciones_api...');
    
    let insertedCount = 0;
    
    for (const record of records) {
      try {
        await pool.query(`
          INSERT INTO mediciones_api (estacion_id, fecha, parametro, valor, is_validated)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          ESTACION_ID,
          record.fecha,
          PARAMETRO,
          record.valor,
          true // Los datos sintéticos los marcamos como validados inicialmente
        ]);
        
        insertedCount++;
        
      } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`⚠️ Duplicado encontrado para hora ${record.hora}:00`);
        } else {
          console.error(`❌ Error insertando hora ${record.hora}:00:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Inserción completada:`);
    console.log(`   - Registros insertados: ${insertedCount}/${records.length}`);
    
    // Verificar los datos insertados
    const verification = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM fecha) as hora,
        valor,
        is_validated
      FROM mediciones_api 
      WHERE DATE(fecha) = $1 AND estacion_id = $2 AND parametro = $3
      ORDER BY fecha ASC
    `, [TARGET_DATE, ESTACION_ID, PARAMETRO]);
    
    console.log(`\n📊 Verificación - Datos en BD para ${TARGET_DATE}:`);
    verification.rows.forEach(row => {
      console.log(`   ${row.hora.toString().padStart(2, '0')}:00 → ${row.valor} µg/m³ (validated: ${row.is_validated})`);
    });
    
    console.log('\n🎯 Datos listos para probar el algoritmo de:');
    console.log('   1. Cálculo de promedio diario');
    console.log('   2. Interpolación de datos faltantes');
    console.log('   3. Inserción en promedios_diarios');
    
  } catch (error) {
    console.error('❌ Error generando datos sintéticos:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  generateSyntheticData();
}

module.exports = { generateSyntheticData }; 