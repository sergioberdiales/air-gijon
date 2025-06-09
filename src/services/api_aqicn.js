// libs: npm i node-fetch@2 dotenv
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const { pool } = require('../database/db');

// Cargar variables de entorno solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  const result = dotenv.config();
  console.log('Resultado de carga .env:', result);
  console.log('Variables de entorno cargadas:', {
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST
  });
}

// Configuración
const CONFIG = {
  TOKEN: process.env.AQICN_API_KEY,
  BASE_URL: 'https://api.waqi.info/feed',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ms
};

// Validar configuración
if (!CONFIG.TOKEN) {
  throw new Error('AQICN_API_KEY no está configurado en las variables de entorno');
}

/**
 * Limpia datos antiguos (más de 30 días) para mantener la tabla optimizada
 */
async function cleanOldData() {
  try {
    const result = await pool.query(`
      DELETE FROM mediciones_api 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    console.log(`✅ Eliminados ${result.rowCount} registros antiguos (>30 días)`);
    return result.rowCount;
  } catch (error) {
    console.error('⚠️ Error al limpiar datos antiguos:', error.message);
    // No lanzamos error para que no interrumpa el proceso principal
    return 0;
  }
}

/**
 * Verifica si ya existen datos para una fecha y estación específica
 */
async function checkExistingData(stationId, measurementTime) {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM mediciones_api 
      WHERE estacion_id = $1 AND fecha = $2
    `, [stationId, measurementTime]);
    
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error verificando datos existentes:', error.message);
    return false;
  }
}

/**
 * Almacena los datos de calidad del aire en la base de datos (solo si no existen)
 * @param {Object} data - Datos de calidad del aire
 */
async function storeAirQualityData(data) {
  const client = await pool.connect();
  
  try {
    // Verificar si ya existen datos para esta fecha y estación
    const dataExists = await checkExistingData(data.stationId, data.measurementTime);
    
    if (dataExists) {
      console.log(`ℹ️ Los datos para ${data.measurementTime} ya existen, actualizando...`);
      
      // Actualizar datos existentes
      await client.query('BEGIN');
      
      // Primero eliminar los datos existentes para esta fecha y estación
      await client.query(`
        DELETE FROM mediciones_api 
        WHERE estacion_id = $1 AND fecha = $2
      `, [data.stationId, data.measurementTime]);
      
      // Luego insertar los nuevos datos
      for (const param of data.parameters) {
        const query = `
          INSERT INTO mediciones_api (
            estacion_id,
            fecha,
            parametro,
            valor,
            aqi,
            is_validated
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const values = [
          data.stationId,
          data.measurementTime,
          param.parameter,
          param.value,
          data.aqi,
          true
        ];

        await client.query(query, values);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Datos actualizados correctamente para ${data.parameters.length} parámetros`);
    } else {
      console.log(`📝 Insertando nuevos datos para ${data.measurementTime}...`);
      
      await client.query('BEGIN');

      // Insertar cada parámetro como un registro separado
      for (const param of data.parameters) {
        const query = `
          INSERT INTO mediciones_api (
            estacion_id,
            fecha,
            parametro,
            valor,
            aqi,
            is_validated
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const values = [
          data.stationId,
          data.measurementTime,
          param.parameter,
          param.value,
          data.aqi,
          true
        ];

        await client.query(query, values);
      }

      await client.query('COMMIT');
      console.log(`✅ Nuevos datos almacenados correctamente para ${data.parameters.length} parámetros`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Error al almacenar datos: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Obtiene estadísticas de la tabla de datos
 */
async function getDataStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(DISTINCT estacion_id) as estaciones,
        COUNT(DISTINCT DATE(fecha)) as dias_con_datos,
        MIN(fecha) as fecha_mas_antigua,
        MAX(fecha) as fecha_mas_reciente
      FROM mediciones_api
    `);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error.message);
    return null;
  }
}

/**
 * Obtiene datos de calidad del aire para una estación específica
 * @param {string} stationId - ID de la estación
 * @returns {Promise<Object>} Datos de calidad del aire
 */
async function getAirQualityData(stationId) {
  const url = `${CONFIG.BASE_URL}/@${stationId}/?token=${CONFIG.TOKEN}`;
  let lastError;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'ok') {
        return {
          timestamp: new Date(),
          stationId,
          aqi: data.data.aqi,
          measurementTime: data.data.time.s,
          parameters: Object.entries(data.data.iaqi).map(([key, value]) => ({
            parameter: key,
            value: value.v
          }))
        };
      } else {
        throw new Error(`API error: ${data.status}`);
      }
    } catch (error) {
      lastError = error;
      console.error(`Intento ${attempt}/${CONFIG.MAX_RETRIES} fallido:`, error.message);
      
      if (attempt < CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      }
    }
  }

  throw new Error(`Failed after ${CONFIG.MAX_RETRIES} attempts. Last error: ${lastError.message}`);
}

// Función legacy mantenida para compatibilidad (pero ya no se usa)
async function cleanMedicionesApi() {
  console.log('⚠️ cleanMedicionesApi está deprecada. Ahora se mantienen datos históricos.');
  console.log('💡 Usa cleanOldData() para limpiar solo datos antiguos.');
}

// Exportar las funciones necesarias
module.exports = {
  getAirQualityData,
  storeAirQualityData,
  cleanMedicionesApi, // Mantenida para compatibilidad
  cleanOldData,
  getDataStats,
  checkExistingData
};