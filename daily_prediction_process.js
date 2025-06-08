require('dotenv').config({ path: './.env_local' });
const { pool } = require('./db');
const { getEstadoPM25_OMS } = require('./update_pm25_states');

/**
 * Proceso diario de predicciones
 * 1. Calcula promedio diario del día anterior desde mediciones_api
 * 2. Interpola datos faltantes
 * 3. Inserta en promedios_diarios
 * 4. [Futuro] Genera variables del modelo y ejecuta predicciones
 */

const ESTACION_ID = '6699'; // Avenida Constitución
const PARAMETRO = 'pm25';

/**
 * Interpola valores faltantes usando interpolación lineal
 * @param {Array} hourlyData - Array de objetos {hora, valor} ordenado por hora
 * @returns {Array} - Array con datos interpolados
 */
function interpolateMissingValues(hourlyData) {
  const interpolated = [...hourlyData];
  const missingHours = [];
  
  // Identificar horas faltantes
  for (let hora = 0; hora < 24; hora++) {
    const exists = interpolated.find(d => d.hora === hora);
    if (!exists) {
      missingHours.push(hora);
    }
  }
  
  console.log(`🔍 Horas faltantes identificadas: ${missingHours.join(', ')}`);
  
  // Interpolar cada hora faltante
  for (const missingHour of missingHours) {
    // Buscar el valor anterior más cercano
    let prevValue = null;
    let prevHour = missingHour - 1;
    while (prevHour >= 0 && !prevValue) {
      const prev = interpolated.find(d => d.hora === prevHour);
      if (prev) prevValue = { hora: prevHour, valor: prev.valor };
      prevHour--;
    }
    
    // Buscar el valor siguiente más cercano
    let nextValue = null;
    let nextHour = missingHour + 1;
    while (nextHour < 24 && !nextValue) {
      const next = interpolated.find(d => d.hora === nextHour);
      if (next) nextValue = { hora: nextHour, valor: next.valor };
      nextHour++;
    }
    
    let interpolatedValue;
    
    if (prevValue && nextValue) {
      // Interpolación lineal entre valores anterior y siguiente
      const hoursGap = nextValue.hora - prevValue.hora;
      const valueGap = nextValue.valor - prevValue.valor;
      const hoursFromPrev = missingHour - prevValue.hora;
      
      interpolatedValue = prevValue.valor + (valueGap * hoursFromPrev / hoursGap);
      console.log(`📐 Hora ${missingHour}: Interpolación lineal entre ${prevValue.hora}h (${prevValue.valor}) y ${nextValue.hora}h (${nextValue.valor}) → ${interpolatedValue.toFixed(2)} µg/m³`);
    } else if (prevValue) {
      // Solo hay valor anterior, usar ese
      interpolatedValue = prevValue.valor;
      console.log(`📐 Hora ${missingHour}: Usando valor anterior ${prevValue.hora}h → ${interpolatedValue.toFixed(2)} µg/m³`);
    } else if (nextValue) {
      // Solo hay valor siguiente, usar ese
      interpolatedValue = nextValue.valor;
      console.log(`📐 Hora ${missingHour}: Usando valor siguiente ${nextValue.hora}h → ${interpolatedValue.toFixed(2)} µg/m³`);
    } else {
      // No hay valores de referencia, usar un valor por defecto
      interpolatedValue = 25.0; // Valor promedio típico
      console.log(`📐 Hora ${missingHour}: Sin referencias, usando valor por defecto → ${interpolatedValue} µg/m³`);
    }
    
    interpolated.push({
      hora: missingHour,
      valor: Math.round(interpolatedValue * 100) / 100,
      interpolated: true
    });
  }
  
  // Ordenar por hora
  return interpolated.sort((a, b) => a.hora - b.hora);
}

/**
 * Calcula el promedio diario de PM2.5 para una fecha específica
 * @param {string} targetDate - Fecha en formato YYYY-MM-DD
 * @returns {Object} - {promedio, totalHoras, horasInterpoladas, detalles}
 */
async function calculateDailyAverage(targetDate) {
  try {
    console.log(`\n🔄 Calculando promedio diario para ${targetDate}...`);
    
    // Obtener datos horarios del día
    const result = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM fecha) as hora,
        valor,
        is_validated
      FROM mediciones_api 
      WHERE DATE(fecha) = $1 
        AND estacion_id = $2 
        AND parametro = $3
      ORDER BY fecha ASC
    `, [targetDate, ESTACION_ID, PARAMETRO]);
    
    const originalData = result.rows.map(row => ({
      hora: parseInt(row.hora),
      valor: parseFloat(row.valor),
      is_validated: row.is_validated
    }));
    
    console.log(`📊 Datos originales encontrados: ${originalData.length}/24 horas`);
    
    if (originalData.length === 0) {
      throw new Error(`No se encontraron datos para la fecha ${targetDate}`);
    }
    
    // Interpolar valores faltantes
    const completeData = interpolateMissingValues(originalData);
    const interpolatedCount = completeData.filter(d => d.interpolated).length;
    
    console.log(`📐 Datos después de interpolación: ${completeData.length}/24 horas (${interpolatedCount} interpoladas)`);
    
    // Calcular promedio
    const totalValor = completeData.reduce((sum, d) => sum + d.valor, 0);
    const promedio = totalValor / completeData.length;
    
    console.log(`📈 Promedio calculado: ${promedio.toFixed(2)} µg/m³`);
    
    // Mostrar detalles hora por hora
    console.log('\n📋 Detalles hora por hora:');
    completeData.forEach(d => {
      const status = d.interpolated ? '(interpolado)' : '(original)';
      console.log(`   ${d.hora.toString().padStart(2, '0')}:00 → ${d.valor.toFixed(2)} µg/m³ ${status}`);
    });
    
    return {
      promedio: Math.round(promedio * 100) / 100,
      totalHoras: completeData.length,
      horasInterpoladas: interpolatedCount,
      detalles: completeData
    };
    
  } catch (error) {
    console.error('❌ Error calculando promedio diario:', error);
    throw error;
  }
}

/**
 * Inserta el promedio diario en la tabla promedios_diarios
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {number} promedio - Valor promedio de PM2.5
 * @param {number} horasInterpoladas - Número de horas interpoladas
 */
async function insertDailyAverage(fecha, promedio, horasInterpoladas) {
  try {
    console.log(`\n🔄 Insertando promedio diario en promedios_diarios...`);
    
    // Verificar si ya existe
    const existing = await pool.query(
      'SELECT id FROM promedios_diarios WHERE fecha = $1 AND parametro = $2',
      [fecha, PARAMETRO]
    );
    
    if (existing.rows.length > 0) {
      console.log(`⚠️ Ya existe un registro para ${fecha}. Actualizando...`);
      
      await pool.query(`
        UPDATE promedios_diarios 
        SET valor = $1, estado = $2, source = $3, updated_at = CURRENT_TIMESTAMP
        WHERE fecha = $4 AND parametro = $5
      `, [
        promedio,
        getEstadoPM25_OMS(promedio),
        horasInterpoladas > 0 ? 'mediciones_api_interpolado' : 'mediciones_api',
        fecha,
        PARAMETRO
      ]);
      
      console.log('✅ Registro actualizado');
    } else {
      await pool.query(`
        INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        fecha,
        PARAMETRO,
        promedio,
        getEstadoPM25_OMS(promedio),
        horasInterpoladas > 0 ? 'mediciones_api_interpolado' : 'mediciones_api'
      ]);
      
      console.log('✅ Nuevo registro insertado');
    }
    
    console.log(`📊 Resumen del registro:`);
    console.log(`   Fecha: ${fecha}`);
    console.log(`   Promedio: ${promedio} µg/m³`);
    console.log(`   Estado OMS: ${getEstadoPM25_OMS(promedio)}`);
    console.log(`   Horas interpoladas: ${horasInterpoladas}/24`);
    
  } catch (error) {
    console.error('❌ Error insertando promedio diario:', error);
    throw error;
  }
}

/**
 * Proceso principal diario
 * @param {string} targetDate - Fecha a procesar (por defecto: ayer)
 */
async function runDailyProcess(targetDate = null) {
  try {
    // Si no se especifica fecha, usar el día anterior
    if (!targetDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split('T')[0];
    }
    
    console.log('🚀 INICIO DEL PROCESO DIARIO DE PREDICCIONES');
    console.log('='.repeat(50));
    console.log(`📅 Procesando fecha: ${targetDate}`);
    
    // Paso 1: Calcular promedio diario
    const averageResult = await calculateDailyAverage(targetDate);
    
    // Paso 2: Insertar en promedios_diarios
    await insertDailyAverage(
      targetDate, 
      averageResult.promedio, 
      averageResult.horasInterpoladas
    );
    
    console.log('\n✅ PROCESO DIARIO COMPLETADO');
    console.log('='.repeat(50));
    
    // TODO: Próximos pasos
    console.log('\n🎯 Próximos pasos (por implementar):');
    console.log('   1. Generar 33 variables del modelo LightGBM');
    console.log('   2. Ejecutar predicción día actual (horizonte_dias=0)');
    console.log('   3. Ejecutar predicción día siguiente (horizonte_dias=1)');
    console.log('   4. Insertar predicciones en tabla predicciones');
    
    return {
      success: true,
      fecha: targetDate,
      promedio: averageResult.promedio,
      horasInterpoladas: averageResult.horasInterpoladas
    };
    
  } catch (error) {
    console.error('❌ ERROR EN EL PROCESO DIARIO:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  // Para pruebas, usar la fecha que acabamos de generar datos sintéticos
  const testDate = process.argv[2] || '2025-06-04';
  runDailyProcess(testDate);
}

module.exports = { 
  runDailyProcess, 
  calculateDailyAverage, 
  insertDailyAverage,
  interpolateMissingValues 
}; 