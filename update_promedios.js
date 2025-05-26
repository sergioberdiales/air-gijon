#!/usr/bin/env node

const { testConnection } = require('./db');
const { actualizacionDiaria } = require('./promedios_predicciones');

async function main() {
  try {
    console.log('🌅 Iniciando script de actualización de promedios y predicciones...');
    console.log('📅 Fecha:', new Date().toISOString());
    
    // Verificar conexión a la base de datos
    await testConnection();
    
    // Ejecutar actualización diaria
    await actualizacionDiaria();
    
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en el script de actualización:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { main }; 