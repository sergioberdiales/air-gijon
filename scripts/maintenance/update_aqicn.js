// Cargar variables de entorno solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { getAirQualityData, storeAirQualityData, cleanOldData, getDataStats } = require('../../src/services/api_aqicn');
const { pool, testConnection } = require('../../src/database/db');

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
    
    // Mostrar estadísticas actuales
    console.log('📊 Estadísticas actuales de la base de datos:');
    const stats = await getDataStats();
    if (stats) {
      console.log(`   • Total registros: ${stats.total_registros}`);
      console.log(`   • Estaciones: ${stats.estaciones}`);
      console.log(`   • Días con datos: ${stats.dias_con_datos}`);
      console.log(`   • Fecha más antigua: ${stats.fecha_mas_antigua}`);
      console.log(`   • Fecha más reciente: ${stats.fecha_mas_reciente}`);
    }
    
    // DESHABILITADO: Limpiar datos antiguos (>30 días) - conservamos históricos
    // console.log('🧹 Limpiando datos antiguos (>30 días)...');
    // const deletedCount = await cleanOldData();
    // if (deletedCount > 0) {
    //   console.log(`   • Eliminados ${deletedCount} registros antiguos`);
    // } else {
    //   console.log('   • No hay datos antiguos para eliminar');
    // }
    console.log('💾 Conservando todos los datos históricos (limpieza deshabilitada)');
    
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
    
    // Mostrar estadísticas finales
    console.log('📊 Estadísticas finales:');
    const finalStats = await getDataStats();
    if (finalStats) {
      console.log(`   • Total registros: ${finalStats.total_registros}`);
      console.log(`   • Días con datos: ${finalStats.dias_con_datos}`);
      console.log(`   • Fecha más reciente: ${finalStats.fecha_mas_reciente}`);
    }
    
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