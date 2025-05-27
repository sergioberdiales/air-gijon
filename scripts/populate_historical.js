const { Pool } = require('pg');
const axios = require('axios');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configuración de la API
const AQICN_TOKEN = process.env.AQICN_TOKEN;
const STATION_ID = '6699'; // ID de la estación de Avenida Constitución

// Función para obtener datos de un día específico
async function getHistoricalData(date) {
  try {
    const response = await axios.get(`https://api.waqi.info/feed/@${STATION_ID}/?token=${AQICN_TOKEN}&date=${date}`);
    
    if (response.data.status === 'ok' && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error(`Error obteniendo datos para ${date}:`, error.message);
    return null;
  }
}

// Función para insertar datos en la base de datos
async function insertData(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insertar datos de PM10
    if (data.iaqi?.pm10?.v) {
      await client.query(
        `INSERT INTO mediciones_api (estacion_id, fecha, parametro, valor, aqi, is_validated)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (estacion_id, fecha, parametro) 
         DO UPDATE SET valor = EXCLUDED.valor, aqi = EXCLUDED.aqi`,
        [STATION_ID, new Date(data.time.v * 1000), 'pm10', data.iaqi.pm10.v, data.aqi, true]
      );
    }

    // Insertar datos de NO2
    if (data.iaqi?.no2?.v) {
      await client.query(
        `INSERT INTO mediciones_api (estacion_id, fecha, parametro, valor, aqi, is_validated)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (estacion_id, fecha, parametro) 
         DO UPDATE SET valor = EXCLUDED.valor, aqi = EXCLUDED.aqi`,
        [STATION_ID, new Date(data.time.v * 1000), 'no2', data.iaqi.no2.v, data.aqi, true]
      );
    }

    // Insertar otros parámetros disponibles
    const otherParams = ['pm25', 'o3', 'so2', 'co', 'h', 't', 'p', 'w', 'wg'];
    for (const param of otherParams) {
      if (data.iaqi?.[param]?.v !== undefined) {
        await client.query(
          `INSERT INTO mediciones_api (estacion_id, fecha, parametro, valor, aqi, is_validated)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (estacion_id, fecha, parametro) 
           DO UPDATE SET valor = EXCLUDED.valor, aqi = EXCLUDED.aqi`,
          [STATION_ID, new Date(data.time.v * 1000), param, data.iaqi[param].v, data.aqi, true]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Datos insertados correctamente para ${new Date(data.time.v * 1000).toISOString()}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error insertando datos:', error);
  } finally {
    client.release();
  }
}

// Función principal para poblar datos históricos
async function populateHistoricalData() {
  try {
    // Obtener fechas de los últimos 7 días
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    console.log('Iniciando población de datos históricos...');
    console.log('Fechas a procesar:', dates);

    // Procesar cada fecha
    for (const date of dates) {
      console.log(`\nProcesando fecha: ${date}`);
      const data = await getHistoricalData(date);
      
      if (data) {
        await insertData(data);
      } else {
        console.log(`No se encontraron datos para ${date}`);
      }

      // Esperar 1 segundo entre llamadas para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\nProceso completado');
  } catch (error) {
    console.error('Error en el proceso:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
populateHistoricalData(); 