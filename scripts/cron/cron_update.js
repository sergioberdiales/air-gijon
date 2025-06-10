#!/usr/bin/env node

// Script simplificado para cron job en Render
// Versión robusta con manejo de errores mejorado

console.log('🚀 CRON JOB - Air Gijón - Iniciando...');
console.log(`Timestamp: ${new Date().toISOString()}`);

// Verificaciones iniciales
console.log('\n🔍 VERIFICACIONES INICIALES:');
console.log(`Node.js: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Configurada' : 'NO CONFIGURADA'}`);

// Verificar variables críticas
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR CRÍTICO: DATABASE_URL no está configurada');
  console.error('💡 SOLUCIÓN: Configurar DATABASE_URL en las variables de entorno del cron job');
  process.exit(1);
}

// Función principal con manejo robusto de errores
async function main() {
  let pool;
  
  try {
    // Cargar módulos después de verificar variables
    console.log('\n📦 Cargando módulos...');
    const { getAirQualityData, storeAirQualityData, cleanOldData, getDataStats } = require('../../src/services/api_aqicn');
    const { pool: dbPool, testConnection } = require('../../src/database/db');
    pool = dbPool;

    // Test de conexión
    console.log('\n🔗 Verificando conexión a base de datos...');
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Conexión a base de datos falló');
    }
    console.log('✅ Conexión exitosa');

    const STATION_ID = '6699'; // Avenida Constitución
    
    // Estadísticas iniciales
    console.log('\n📊 Estadísticas iniciales:');
    const initialStats = await getDataStats();
    if (initialStats) {
      console.log(`   Registros: ${initialStats.total_registros}`);
      console.log(`   Días: ${initialStats.dias_con_datos}`);
      console.log(`   Última fecha: ${initialStats.fecha_mas_reciente}`);
    }
    
    // DESHABILITADO: Limpiar datos antiguos (>30 días) - conservamos históricos  
    // console.log('\n🧹 Limpiando datos antiguos...');
    // const deletedCount = await cleanOldData();
    // console.log(`   Eliminados: ${deletedCount} registros`);
    console.log('\n💾 Conservando todos los datos históricos (limpieza deshabilitada)');
    
    // Obtener nuevos datos
    console.log('\n📥 Obteniendo datos de AQICN...');
    const data = await getAirQualityData(STATION_ID);
    console.log(`   AQI: ${data.aqi}`);
    console.log(`   Parámetros: ${data.parameters.length}`);
    console.log(`   Fecha: ${data.measurementTime}`);
    
    // Almacenar datos
    console.log('\n💾 Almacenando datos...');
    await storeAirQualityData(data);
    
    // Estadísticas finales
    console.log('\n📊 Estadísticas finales:');
    const finalStats = await getDataStats();
    if (finalStats) {
      console.log(`   Registros: ${finalStats.total_registros}`);
      console.log(`   Días: ${finalStats.dias_con_datos}`);
      console.log(`   Última fecha: ${finalStats.fecha_mas_reciente}`);
    }
    
    console.log('\n✅ CRON JOB COMPLETADO EXITOSAMENTE');
    
  } catch (error) {
    console.error('\n❌ ERROR EN CRON JOB:', error.message);
    console.error('Stack:', error.stack);
    
    process.exit(1);
  } finally {
    // Cerrar conexión de base de datos
    if (pool) {
      try {
        await pool.end();
        console.log('🔌 Conexión cerrada');
      } catch (error) {
        console.error('⚠️ Error cerrando conexión:', error.message);
      }
    }
  }
}

// Manejo de señales del sistema
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM recibido, cerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT recibido, cerrando...');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// Ejecutar
main(); 