require('dotenv').config({ path: './.env_local' });
const { pool } = require('./db');

/**
 * Script para actualizar los estados de PM2.5 en la tabla promedios_diarios
 * usando los rangos oficiales de la OMS
 */

/**
 * Función para calcular el estado según los rangos oficiales de la OMS
 * @param {number} pm25 - Valor de PM2.5 en µg/m³
 * @returns {string} - Estado correspondiente
 */
function getEstadoPM25_OMS(pm25) {
  if (pm25 <= 15) return 'AQG'; // Aire "seguro"; riesgo mínimo
  if (pm25 <= 25) return 'IT-4'; // Riesgo leve; vigilar población sensible
  if (pm25 <= 37.5) return 'IT-3'; // Riesgo moderado; sensibles deben limitar actividad exterior
  if (pm25 <= 50) return 'IT-2'; // Riesgo alto; la población general puede notar síntomas
  if (pm25 <= 75) return 'IT-1'; // Riesgo muy alto; evitar ejercicio al aire libre
  return '> IT-1'; // Riesgo extremo; permanecer en interiores
}

/**
 * Función para obtener la descripción del estado
 * @param {string} estado - Estado OMS
 * @returns {string} - Descripción del estado
 */
function getDescripcionEstado(estado) {
  const descripciones = {
    'AQG': 'Aire "seguro"; riesgo mínimo',
    'IT-4': 'Riesgo leve; vigilar población sensible',
    'IT-3': 'Riesgo moderado; sensibles deben limitar actividad exterior',
    'IT-2': 'Riesgo alto; la población general puede notar síntomas',
    'IT-1': 'Riesgo muy alto; evitar ejercicio al aire libre',
    '> IT-1': 'Riesgo extremo; permanecer en interiores'
  };
  return descripciones[estado] || 'Desconocido';
}

async function updatePM25States() {
  try {
    console.log('🔄 Iniciando actualización de estados PM2.5 con rangos OMS...');
    
    // Obtener todos los registros de PM2.5
    const result = await pool.query(`
      SELECT id, fecha, valor, estado 
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      ORDER BY fecha ASC
    `);
    
    console.log(`📊 Encontrados ${result.rows.length} registros de PM2.5 para actualizar`);
    
    if (result.rows.length === 0) {
      console.log('❌ No se encontraron registros de PM2.5 para actualizar');
      return;
    }
    
    let updatedCount = 0;
    let unchangedCount = 0;
    const estadosSummary = {};
    
    for (const row of result.rows) {
      const nuevoEstado = getEstadoPM25_OMS(parseFloat(row.valor));
      
      // Contar estados para resumen
      if (!estadosSummary[nuevoEstado]) {
        estadosSummary[nuevoEstado] = 0;
      }
      estadosSummary[nuevoEstado]++;
      
      // Actualizar solo si el estado cambió
      if (row.estado !== nuevoEstado) {
        await pool.query(`
          UPDATE promedios_diarios 
          SET estado = $1 
          WHERE id = $2
        `, [nuevoEstado, row.id]);
        
        console.log(`📅 ${row.fecha}: ${row.valor} µg/m³ - ${row.estado} → ${nuevoEstado}`);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    console.log('\n✅ Actualización completada:');
    console.log(`   - Registros actualizados: ${updatedCount}`);
    console.log(`   - Registros sin cambios: ${unchangedCount}`);
    console.log(`   - Total procesados: ${result.rows.length}`);
    
    console.log('\n📊 Distribución de estados (rangos OMS):');
    Object.entries(estadosSummary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([estado, count]) => {
        const porcentaje = ((count / result.rows.length) * 100).toFixed(1);
        console.log(`   ${estado}: ${count} registros (${porcentaje}%) - ${getDescripcionEstado(estado)}`);
      });
    
    // Mostrar algunos ejemplos actualizados
    const sample = await pool.query(`
      SELECT fecha, valor, estado 
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      ORDER BY fecha DESC 
      LIMIT 5
    `);
    
    console.log('\n📋 Últimos 5 registros (con estados OMS):');
    sample.rows.forEach(row => {
      console.log(`   ${row.fecha}: ${row.valor} µg/m³ → ${row.estado} (${getDescripcionEstado(row.estado)})`);
    });
    
  } catch (error) {
    console.error('❌ Error actualizando estados:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  updatePM25States();
}

module.exports = { updatePM25States, getEstadoPM25_OMS, getDescripcionEstado }; 