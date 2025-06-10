const { pool, createUser } = require('./src/database/db');
const bcrypt = require('bcryptjs');

async function createProductionAdmin() {
  try {
    console.log('🔧 Creando usuario admin de producción...');
    
    const adminEmail = 'admin@air-gijon.es';
    const adminPassword = 'AdminAirGijon2025!';
    
    // Verificar si ya existe
    const existingUser = await pool.query(
      'SELECT id, email, role_id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (existingUser.rows.length > 0) {
      // Si existe, asegurar que tiene rol de admin
      const user = existingUser.rows[0];
      if (user.role_id !== 2) {
        await pool.query(
          'UPDATE users SET role_id = 2 WHERE id = $1',
          [user.id]
        );
        console.log('✅ Usuario admin actualizado con rol de administrador');
      } else {
        console.log('✅ Usuario admin ya existe con permisos correctos');
      }
    } else {
      // Crear nuevo usuario admin
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const newUser = await createUser(adminEmail, hashedPassword, 2, 'Administrador');
      
      // Confirmar automáticamente
      await pool.query(
        'UPDATE users SET is_confirmed = true WHERE id = $1',
        [newUser.id]
      );
      
      console.log('✅ Usuario admin creado exitosamente');
    }
    
    // Verificar el resultado final
    const finalCheck = await pool.query(`
      SELECT u.id, u.email, u.role_id, r.name as role_name, u.is_confirmed
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.email = $1
    `, [adminEmail]);
    
    console.log('🔍 Usuario admin final:', finalCheck.rows[0]);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

createProductionAdmin(); 