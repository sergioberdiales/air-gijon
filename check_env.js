#!/usr/bin/env node

console.log('🔍 Verificando variables de entorno...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL presente:', process.env.DATABASE_URL ? 'Sí' : 'No');

if (process.env.DATABASE_URL) {
  // Mostrar solo los primeros y últimos caracteres para seguridad
  const dbUrl = process.env.DATABASE_URL;
  const masked = dbUrl.substring(0, 20) + '...' + dbUrl.substring(dbUrl.length - 20);
  console.log('DATABASE_URL (parcial):', masked);
} else {
  console.log('❌ DATABASE_URL no está configurada');
}

console.log('\n📋 Todas las variables de entorno disponibles:');
const envVars = Object.keys(process.env).sort();
envVars.forEach(key => {
  if (key.includes('DB') || key.includes('DATABASE') || key.includes('POSTGRES')) {
    console.log(`${key}: ${process.env[key] ? 'Configurada' : 'No configurada'}`);
  }
});

console.log('\n🔗 Intentando conexión a la base de datos...');
const { testConnection } = require('./db');

testConnection()
  .then(success => {
    if (success) {
      console.log('✅ Conexión exitosa');
      process.exit(0);
    } else {
      console.log('❌ Conexión fallida');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }); 