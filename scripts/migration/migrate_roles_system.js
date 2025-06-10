#!/usr/bin/env node

// Script de migración para implementar sistema de roles normalizado
const { pool } = require('../../src/database/db');
const bcrypt = require('bcrypt');

async function migrateRolesSystem() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando migración del sistema de roles...');
    
    await client.query('BEGIN');
    
    // 1. Crear tabla de roles
    console.log('📝 Creando tabla de roles...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 2. Insertar roles básicos
    console.log('📋 Insertando roles básicos...');
    await client.query(`
      INSERT INTO roles (name, description) VALUES 
        ('user', 'Usuario estándar con acceso a funcionalidades básicas'),
        ('admin', 'Administrador del sistema con acceso completo')
      ON CONFLICT (name) DO NOTHING;
    `);
    
    // 3. Agregar columna role_id a users
    console.log('🔧 Agregando columna role_id a tabla users...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) DEFAULT 1;
    `);
    
    // 4. Migrar datos existentes
    console.log('🔄 Migrando datos existentes...');
    
    // Obtener IDs de roles
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roles = {};
    rolesResult.rows.forEach(role => {
      roles[role.name] = role.id;
    });
    
    // Migrar usuarios existentes
    await client.query(`
      UPDATE users 
      SET role_id = $1 
      WHERE role = 'external' OR role IS NULL
    `, [roles.user]);
    
    // Verificar cuántos usuarios se migraron
    const migratedCount = await client.query(`
      SELECT COUNT(*) as count FROM users WHERE role_id = $1
    `, [roles.user]);
    
    console.log(`✅ ${migratedCount.rows[0].count} usuarios migrados a rol 'user'`);
    
    // 5. Crear usuario administrador inicial
    console.log('👤 Creando usuario administrador inicial...');
    
    const adminEmail = 'admin@air-gijon.es';
    const adminPassword = 'AdminAirGijon2025!'; // Cambiar después del primer login
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    
    try {
      await client.query(`
        INSERT INTO users (email, password_hash, role_id, name, is_confirmed)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (email) DO UPDATE SET 
          role_id = $3,
          is_confirmed = true,
          updated_at = CURRENT_TIMESTAMP
      `, [adminEmail, adminPasswordHash, roles.admin, 'Administrador del Sistema']);
      
      console.log(`✅ Usuario administrador creado: ${adminEmail}`);
      console.log(`🔑 Contraseña temporal: ${adminPassword}`);
      
    } catch (error) {
      console.log('⚠️ Usuario admin ya existe o error en creación:', error.message);
    }
    
    // 6. Eliminar columna role antigua
    console.log('🗑️ Eliminando columna role antigua...');
    await client.query('ALTER TABLE users DROP COLUMN IF EXISTS role');
    
    // 7. Crear índices
    console.log('📊 Creando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
      CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
    `);
    
    // 8. Verificación final
    console.log('🔍 Verificación final...');
    const finalStats = await client.query(`
      SELECT 
        r.name as role_name,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id, r.name
      ORDER BY r.id
    `);
    
    console.log('\n📊 Estadísticas finales:');
    finalStats.rows.forEach(stat => {
      console.log(`   ${stat.role_name}: ${stat.user_count} usuarios`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ Migración del sistema de roles completada exitosamente');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateRolesSystem()
    .then(() => {
      console.log('🏁 Script de migración de roles finalizado.');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Fallo crítico en la migración:', err);
      process.exit(1);
    });
}

module.exports = { migrateRolesSystem }; 