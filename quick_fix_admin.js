const { pool } = require('./src/database/db');

async function fixAdminUser() {
  try {
    console.log('🔧 Arreglando usuario admin local...');
    
    // Verificar roles disponibles
    const rolesResult = await pool.query('SELECT id, name FROM roles ORDER BY id');
    console.log('📋 Roles disponibles:', rolesResult.rows);
    
    // Verificar usuario admin local actual
    const userResult = await pool.query(`
      SELECT u.id, u.email, u.role_id, r.name as role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.email = 'admin-local@air-gijon.es'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Usuario admin-local@air-gijon.es no encontrado');
      return;
    }
    
    console.log('👤 Usuario actual:', userResult.rows[0]);
    
    // Actualizar a rol de admin (role_id = 2)
    const updateResult = await pool.query(
      'UPDATE users SET role_id = 2 WHERE email = $1 RETURNING id, email, role_id',
      ['admin-local@air-gijon.es']
    );
    
    console.log('✅ Usuario actualizado:', updateResult.rows[0]);
    
    // Verificar el cambio
    const verifyResult = await pool.query(`
      SELECT u.id, u.email, u.role_id, r.name as role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.email = 'admin-local@air-gijon.es'
    `);
    
    console.log('🔍 Verificación final:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixAdminUser(); 