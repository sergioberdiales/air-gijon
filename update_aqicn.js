// Cargar variables de entorno solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { getAirQualityData, storeAirQualityData, cleanMedicionesApi } = require('./api_aqicn');
const { pool, testConnection } = require('./db');

async function main() {
  console.log('🚀 Iniciando actualización de datos AQICN...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL configurada:', process.env.DATABASE_URL ? 'Sí' : 'No');
  
  try {
    // Verificar conexión a la base de datos
    console.log('🔍 Verificando conexión a la base de datos...');
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('No se pudo conectar a la base de datos');
    }

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
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    try {
      await pool.end();
      console.log('🔌 Conexión a la base de datos cerrada');
    } catch (error) {
      console.error('⚠️ Error cerrando conexión:', error);
    }
  }
}

main(); 