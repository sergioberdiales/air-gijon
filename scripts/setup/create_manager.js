#!/usr/bin/env node

// Script para crear el primer usuario gestor del sistema
// Uso: node create_manager.js email password [nombre]

// Cargar variables de entorno primero
require('dotenv').config();

console.log('👤 SCRIPT CREACIÓN DE USUARIO GESTOR');
console.log('=====================================\n');

// Verificar argumentos
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ Uso: node create_manager.js <email> <password> [nombre]');
  console.error('\nEjemplo:');
  console.error('  node create_manager.js admin@airgijon.com mipassword123 "Admin Air Gijón"');
  process.exit(1);
}

const [email, password, name] = args;

async function createManager() {
  try {
    // Importar dependencias
    const { registerUser } = require('./auth');
    const { testConnection, createTables, createIndexes } = require('./db');

    console.log('🔍 Verificando configuración...');
    
    // Verificar conexión a BD
    console.log('🔗 Probando conexión a base de datos...');
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('No se pudo conectar a la base de datos');
    }
    console.log('✅ Conexión exitosa\n');

    // Crear tablas si no existen
    console.log('📋 Creando tablas si no existen...');
    await createTables();
    await createIndexes();
    console.log('✅ Tablas verificadas\n');

    // Validar datos
    console.log('📝 Validando datos...');
    if (!email || !email.includes('@')) {
      throw new Error('Email inválido');
    }
    if (!password || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    console.log('✅ Datos válidos\n');

    // Crear usuario gestor
    console.log('👤 Creando usuario gestor...');
    console.log(`   Email: ${email}`);
    console.log(`   Nombre: ${name || 'No especificado'}`);
    console.log(`   Rol: manager\n`);

    const result = await registerUser(email, password, 'manager', name || null);

    if (!result.success) {
      throw new Error(result.error);
    }

    console.log('🎉 ¡USUARIO GESTOR CREADO EXITOSAMENTE!\n');
    console.log('📋 DETALLES:');
    console.log(`   ID: ${result.user.id}`);
    console.log(`   Email: ${result.user.email}`);
    console.log(`   Nombre: ${result.user.name || 'No especificado'}`);
    console.log(`   Rol: ${result.user.role}`);
    console.log(`   Creado: ${result.user.created_at}\n`);
    
    console.log('🔑 TOKEN DE ACCESO:');
    console.log(`   ${result.token}\n`);
    
    console.log('💡 PRÓXIMOS PASOS:');
    console.log('   1. Guarda el token de acceso para hacer pruebas');
    console.log('   2. Configura las variables de email si quieres notificaciones');
    console.log('   3. Accede al dashboard con este usuario\n');
    
    console.log('🔗 ENDPOINTS DISPONIBLES:');
    console.log('   POST /api/users/login - Login');
    console.log('   GET /api/users/dashboard - Dashboard de gestión');
    console.log('   POST /api/users/test-email - Prueba de emails\n');

  } catch (error) {
    console.error('\n❌ ERROR CREANDO USUARIO GESTOR:');
    console.error(`   ${error.message}\n`);
    
    if (error.message.includes('ya está registrado')) {
      console.log('💡 SOLUCIÓN:');
      console.log('   El email ya existe. Usa otro email o haz login con:');
      console.log('   POST /api/users/login');
      console.log(`   { "email": "${email}", "password": "tu_password" }\n`);
    }
    
    process.exit(1);
  }
}

// Verificar variables de entorno
console.log('🔍 VERIFICANDO CONFIGURACIÓN:');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada'}`);
console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Configurada' : '⚠️ No configurada (emails deshabilitados)'}`);
console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Configurada' : '⚠️ No configurada (emails deshabilitados)'}`);
console.log('');

if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  console.error('   Configura la variable de entorno DATABASE_URL con la URL de PostgreSQL\n');
  process.exit(1);
}

// Ejecutar
createManager(); 