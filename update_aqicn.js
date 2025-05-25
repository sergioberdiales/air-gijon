require('dotenv').config();
const { getAirQualityData, storeAirQualityData, cleanMedicionesApi } = require('./api_aqicn');
const { pool } = require('./db');

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
    
    console.log('✅ Datos de AQICN actualizados correctamente');
  } catch (error) {
    console.error('❌ Error actualizando datos de AQICN:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 