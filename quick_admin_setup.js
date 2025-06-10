#!/usr/bin/env node

require('dotenv').config();
const { pool } = require('./src/database/db');

async function setupTestAdmin() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Configurando usuario admin de prueba...');
    
    // Encontrar el usuario admintest@air-gijon.es y convertirlo a admin
    const result = await client.query(`
      UPDATE users 
      SET role_id = 2, is_confirmed = true 
      WHERE email = 'admintest@air-gijon.es'
      RETURNING id, email, role_id, is_confirmed
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Usuario admin configurado:', result.rows[0]);
      console.log('📧 Email: admintest@air-gijon.es');
      console.log('🔑 Password: test123456');
      console.log('👑 Rol: admin (role_id=2)');
      console.log('✅ Confirmado: true');
    } else {
      console.log('❌ Usuario no encontrado');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    pool.end();
  }
}

setupTestAdmin(); 