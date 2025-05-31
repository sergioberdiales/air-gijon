#!/usr/bin/env node

console.log('🔍 VERIFICACIÓN DE VARIABLES DE ENTORNO - Air Gijón');
console.log('================================================');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log(`Node.js: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log('');

// Variables críticas para el funcionamiento
const requiredVars = [
  'DATABASE_URL',
  'WAQI_API_TOKEN',
  'NODE_ENV'
];

// Variables opcionales para emails
const optionalVars = [
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'JWT_SECRET'
];

console.log('📋 VARIABLES REQUERIDAS:');
console.log('========================');

let allRequired = true;
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue = value ? 
    (varName === 'DATABASE_URL' ? 
      `${value.substring(0, 20)}...${value.substring(value.length - 20)}` : 
      (varName === 'WAQI_API_TOKEN' ? 
        `${value.substring(0, 8)}...` : 
        value
      )
    ) : 'NO CONFIGURADA';
  
  console.log(`${status} ${varName}: ${displayValue}`);
  
  if (!value) {
    allRequired = false;
  }
});

console.log('');
console.log('📋 VARIABLES OPCIONALES:');
console.log('========================');

optionalVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️';
  const displayValue = value ? 
    (varName.includes('PASSWORD') || varName.includes('SECRET') ? 
      `${value.substring(0, 8)}...` : 
      value
    ) : 'NO CONFIGURADA';
  
  console.log(`${status} ${varName}: ${displayValue}`);
});

console.log('');
console.log('🔍 DIAGNÓSTICO:');
console.log('===============');

if (allRequired) {
  console.log('✅ Todas las variables requeridas están configuradas');
  
  // Verificar formato de DATABASE_URL
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    if (dbUrl.includes('usuario:password@host:puerto')) {
      console.log('❌ DATABASE_URL parece ser un placeholder, no una URL real');
      console.log('💡 Configura la URL real de PostgreSQL desde Render');
    } else if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      console.log('✅ DATABASE_URL tiene formato válido');
    } else {
      console.log('⚠️ DATABASE_URL tiene formato inesperado');
    }
  }
  
} else {
  console.log('❌ Faltan variables requeridas para el funcionamiento');
  console.log('');
  console.log('🔧 SOLUCIONES:');
  console.log('==============');
  
  if (!process.env.DATABASE_URL) {
    console.log('📌 DATABASE_URL:');
    console.log('   - Ve a tu PostgreSQL database en Render');
    console.log('   - Copia la "External Database URL"');
    console.log('   - Agrégala a las variables de entorno del cron job');
  }
  
  if (!process.env.WAQI_API_TOKEN) {
    console.log('📌 WAQI_API_TOKEN:');
    console.log('   - Obtén un token de https://aqicn.org/data-platform/token/');
    console.log('   - Agrégalo a las variables de entorno del cron job');
  }
}

console.log('');
console.log('📍 Para configurar variables en Render:');
console.log('1. Ve al dashboard del cron job en Render');
console.log('2. Sección "Environment"');
console.log('3. Agrega las variables faltantes');
console.log('4. Guarda y vuelve a ejecutar el cron job');

// Test de conexión a BD si DATABASE_URL existe
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('usuario:password')) {
  console.log('');
  console.log('🔗 PROBANDO CONEXIÓN A BASE DE DATOS...');
  try {
    const { testConnection } = require('./db');
    testConnection()
      .then(() => {
        console.log('✅ Conexión a BD exitosa');
      })
      .catch(error => {
        console.log('❌ Error conectando a BD:', error.message);
      });
  } catch (error) {
    console.log('❌ Error importando módulo de BD:', error.message);
  }
} 