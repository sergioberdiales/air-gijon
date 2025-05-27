// Script de diagnóstico para cron job
// Este script verifica todas las condiciones necesarias para que el cron job funcione

console.log('🔍 DIAGNÓSTICO DEL CRON JOB - Air Gijón');
console.log('=====================================');

// 1. Verificar Node.js y entorno
console.log('\n📋 INFORMACIÓN DEL ENTORNO:');
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`Working directory: ${process.cwd()}`);

// 2. Verificar variables de entorno críticas
console.log('\n🔑 VARIABLES DE ENTORNO:');
const requiredEnvVars = ['DATABASE_URL', 'NODE_ENV'];
let envOk = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName === 'DATABASE_URL') {
      // Mostrar solo parte de la URL por seguridad
      const maskedUrl = value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
      console.log(`✅ ${varName}: ${maskedUrl}`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: NO CONFIGURADA`);
    envOk = false;
  }
});

// 3. Verificar archivos necesarios
console.log('\n📁 ARCHIVOS NECESARIOS:');
const fs = require('fs');
const requiredFiles = [
  'package.json',
  'update_aqicn.js',
  'api_aqicn.js',
  'db.js'
];

let filesOk = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: Existe`);
  } else {
    console.log(`❌ ${file}: NO ENCONTRADO`);
    filesOk = false;
  }
});

// 4. Verificar package.json scripts
console.log('\n📦 SCRIPTS DE PACKAGE.JSON:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = packageJson.scripts || {};
  
  if (scripts['update-aqicn']) {
    console.log(`✅ update-aqicn: ${scripts['update-aqicn']}`);
  } else {
    console.log('❌ update-aqicn: NO DEFINIDO');
    filesOk = false;
  }
} catch (error) {
  console.log(`❌ Error leyendo package.json: ${error.message}`);
  filesOk = false;
}

// 5. Test de conexión a base de datos (solo si las variables están configuradas)
async function testDatabase() {
  if (!envOk) {
    console.log('\n❌ SALTANDO TEST DE BASE DE DATOS: Variables de entorno faltantes');
    return false;
  }

  console.log('\n🗄️ TEST DE CONEXIÓN A BASE DE DATOS:');
  
  try {
    // Cargar dotenv solo en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      require('dotenv').config();
    }
    
    const { pool, testConnection } = require('./db');
    
    console.log('🔗 Intentando conectar...');
    const connectionOk = await testConnection();
    
    if (connectionOk) {
      console.log('✅ Conexión a PostgreSQL exitosa');
      
      // Test básico de consulta
      const result = await pool.query('SELECT NOW() as current_time');
      console.log(`✅ Consulta de prueba exitosa: ${result.rows[0].current_time}`);
      
      await pool.end();
      return true;
    } else {
      console.log('❌ Conexión a PostgreSQL falló');
      return false;
    }
  } catch (error) {
    console.log(`❌ Error en test de base de datos: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    return false;
  }
}

// 6. Test de API AQICN
async function testAPI() {
  console.log('\n🌐 TEST DE API AQICN:');
  
  try {
    const { getAirQualityData } = require('./api_aqicn');
    
    console.log('📡 Obteniendo datos de la API...');
    const data = await getAirQualityData('6699');
    
    console.log('✅ API AQICN responde correctamente');
    console.log(`   AQI: ${data.aqi}`);
    console.log(`   Parámetros: ${data.parameters.length}`);
    console.log(`   Hora medición: ${data.measurementTime}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Error en test de API: ${error.message}`);
    return false;
  }
}

// Función principal
async function main() {
  console.log('\n🚀 EJECUTANDO TESTS...');
  
  let allOk = true;
  
  // Tests síncronos ya ejecutados
  if (!envOk) allOk = false;
  if (!filesOk) allOk = false;
  
  // Tests asíncronos
  const dbOk = await testDatabase();
  if (!dbOk) allOk = false;
  
  const apiOk = await testAPI();
  if (!apiOk) allOk = false;
  
  // Resumen final
  console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:');
  console.log('============================');
  console.log(`Variables de entorno: ${envOk ? '✅' : '❌'}`);
  console.log(`Archivos necesarios: ${filesOk ? '✅' : '❌'}`);
  console.log(`Conexión base de datos: ${dbOk ? '✅' : '❌'}`);
  console.log(`API AQICN: ${apiOk ? '✅' : '❌'}`);
  
  if (allOk) {
    console.log('\n🎉 DIAGNÓSTICO EXITOSO: El cron job debería funcionar correctamente');
    process.exit(0);
  } else {
    console.log('\n❌ DIAGNÓSTICO FALLIDO: Hay problemas que resolver antes de ejecutar el cron job');
    process.exit(1);
  }
}

// Ejecutar diagnóstico
main().catch(error => {
  console.error('\n💥 ERROR CRÍTICO EN DIAGNÓSTICO:', error);
  process.exit(1);
}); 