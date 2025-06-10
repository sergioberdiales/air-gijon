const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Configuración de base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateRolesSystem() {
  console.log('🚀 Iniciando migración del sistema de roles en PRODUCCIÓN...');
  
  const client = await pool.connect();
  
  try {
    // Iniciar transacción para rollback en caso de error
    await client.query('BEGIN');
    
    console.log('📊 Verificando estado actual de la base de datos...');
    
    // 1. Verificar si ya existe la tabla roles
    const rolesTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'roles'
      );
    `);
    
    if (rolesTableExists.rows[0].exists) {
      console.log('⚠️ La tabla roles ya existe. Cancelando migración.');
      await client.query('ROLLBACK');
      return;
    }
    
    // 2. Verificar estado actual de usuarios
    const currentUsers = await client.query(`
      SELECT id, email, role, name 
      FROM users 
      ORDER BY created_at 
      LIMIT 5
    `);
    
    console.log(`📋 Usuarios actuales encontrados: ${currentUsers.rows.length}`);
    currentUsers.rows.forEach(user => {
      console.log(`   - ${user.email}: role="${user.role}"`);
    });
    
    // 3. Crear tabla roles
    console.log('🏗️ Creando tabla roles...');
    await client.query(`
      CREATE TABLE roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // 4. Insertar roles estándar
    console.log('📝 Insertando roles estándar...');
    await client.query(`
      INSERT INTO roles (name, description) VALUES 
      ('user', 'Usuario estándar con acceso básico'),
      ('admin', 'Administrador con acceso completo');
    `);
    
    // 5. Añadir columna role_id a users
    console.log('🔧 Añadiendo columna role_id a tabla users...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN role_id INTEGER REFERENCES roles(id) DEFAULT 1;
    `);
    
    // 6. Migrar datos existentes
    console.log('🔄 Migrando datos existentes...');
    
    // Mapear 'external' -> role_id=1 (user)
    const externalUsers = await client.query(`
      UPDATE users 
      SET role_id = 1 
      WHERE role = 'external' OR role IS NULL;
    `);
    console.log(`   ✅ ${externalUsers.rowCount} usuarios 'external' migrados a role_id=1`);
    
    // Mapear 'manager' -> role_id=2 (admin) 
    const managerUsers = await client.query(`
      UPDATE users 
      SET role_id = 2 
      WHERE role = 'manager';
    `);
    console.log(`   ✅ ${managerUsers.rowCount} usuarios 'manager' migrados a role_id=2`);
    
    // 7. Crear usuario admin si no existe
    console.log('👤 Verificando/creando usuario admin...');
    const adminExists = await client.query(`
      SELECT id FROM users WHERE email = 'admin@air-gijon.es'
    `);
    
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('AdminAirGijon2025!', 12);
      await client.query(`
        INSERT INTO users (
          email, 
          password_hash, 
          role_id, 
          name, 
          is_confirmed,
          email_alerts,
          daily_predictions
        ) VALUES (
          'admin@air-gijon.es', 
          $1, 
          2, 
          'Administrador', 
          true,
          false,
          false
        )
      `, [hashedPassword]);
      console.log('   ✅ Usuario admin creado');
    } else {
      console.log('   ⚠️ Usuario admin ya existe');
    }
    
    // 8. Eliminar constraint check viejo
    console.log('🗑️ Eliminando constraint check antiguo...');
    await client.query(`
      ALTER TABLE users 
      DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    
    // 9. Eliminar columna role antigua
    console.log('🗑️ Eliminando columna role antigua...');
    await client.query(`
      ALTER TABLE users 
      DROP COLUMN role;
    `);
    
    // 10. Crear índice para role_id
    console.log('🔍 Creando índice para role_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role_id 
      ON users(role_id);
    `);
    
    // 11. Verificar migración completada
    console.log('✅ Verificando migración...');
    const finalCheck = await client.query(`
      SELECT 
        u.id, 
        u.email, 
        u.role_id, 
        r.name as role_name,
        u.name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at
      LIMIT 5;
    `);
    
    console.log('📊 Estado final de usuarios:');
    finalCheck.rows.forEach(user => {
      console.log(`   - ${user.email}: role_id=${user.role_id} (${user.role_name})`);
    });
    
    // Confirmar transacción
    await client.query('COMMIT');
    console.log('🎉 ¡Migración completada exitosamente!');
    
    // Mostrar resumen
    const totalUsers = await client.query('SELECT COUNT(*) as count FROM users');
    const adminCount = await client.query('SELECT COUNT(*) as count FROM users WHERE role_id = 2');
    const userCount = await client.query('SELECT COUNT(*) as count FROM users WHERE role_id = 1');
    
    console.log('\n📈 RESUMEN DE MIGRACIÓN:');
    console.log(`   Total usuarios: ${totalUsers.rows[0].count}`);
    console.log(`   Usuarios admin: ${adminCount.rows[0].count}`);
    console.log(`   Usuarios estándar: ${userCount.rows[0].count}`);
    console.log('   ✅ Tabla roles creada');
    console.log('   ✅ Sistema de roles modernizado');
    console.log('   ✅ Usuario admin disponible: admin@air-gijon.es');
    
  } catch (error) {
    console.error('❌ Error durante migración:', error);
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  migrateRolesSystem()
    .then(() => {
      console.log('✅ Migración finalizada');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migración falló:', error);
      process.exit(1);
    });
}

module.exports = { migrateRolesSystem }; 