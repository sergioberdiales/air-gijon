// libs: npm i node-fetch@2 dotenv
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');
const { pool } = require('./db');

// Cargar variables de entorno de manera más explícita
const result = dotenv.config();

// Debug: Mostrar variables de entorno y resultado de carga
console.log('Resultado de carga .env:', result);
console.log('Variables de entorno cargadas:', {
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST
});

// TEMPORAL: Usar el token directamente para pruebas
const TEMP_TOKEN = '4ed30034c188bdd07806729760dc34ab5857725f';

// Configuración
const CONFIG = {
  TOKEN: TEMP_TOKEN, // Temporal para pruebas
  BASE_URL: 'https://api.waqi.info/feed',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ms
};

// Validar configuración
if (!CONFIG.TOKEN) {
  throw new Error('AQICN_TOKEN no está configurado en las variables de entorno');
}

/**
 * Limpia la tabla mediciones_api
 */
async function cleanMedicionesApi() {
  try {
    await pool.query('TRUNCATE TABLE mediciones_api');
    console.log('✅ Tabla mediciones_api limpiada correctamente');
  } catch (error) {
    throw new Error(`Error al limpiar la tabla mediciones_api: ${error.message}`);
  }
}

/**
 * Almacena los datos de calidad del aire en la base de datos
 * @param {Object} data - Datos de calidad del aire
 */
async function storeAirQualityData(data) {
  const client = await pool.connect();
  
  try {
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
    console.log(`✅ Datos almacenados correctamente para ${data.parameters.length} parámetros`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Error al almacenar datos: ${error.message}`);
  } finally {
    client.release();
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

/**
 * Función principal
 */
async function main() {
  try {
    const STATION_ID = '6699'; // Avenida Constitución
    
    // Primero limpiamos la tabla
    console.log('🗑️ Limpiando tabla mediciones_api...');
    await cleanMedicionesApi();
    
    // Obtenemos y almacenamos los nuevos datos
    console.log('📥 Obteniendo datos de la API...');
    const data = await getAirQualityData(STATION_ID);
    
    console.log('📊 Datos obtenidos:');
    console.log('Timestamp:', data.timestamp);
    console.log('AQI:', data.aqi);
    console.log('Hora de medición:', data.measurementTime);
    console.table(data.parameters);
    
    console.log('💾 Almacenando datos en la base de datos...');
    await storeAirQualityData(data);
    
  } catch (error) {
    console.error('❌ Error en la aplicación:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar la aplicación
main();