const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/adminAuth');
const { 
  getAllUsers, 
  updateUserRole, 
  deleteUser, 
  updateUserNotifications,
  getAdminDashboardStats 
} = require('../database/db');

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware de autenticación para todas las rutas admin
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/users - Obtener lista de usuarios
router.get('/users', async (req, res) => {
  try {
    console.log('📋 Obteniendo lista de usuarios para admin...');
    const users = await getAllUsers();
    
    res.json({
      success: true,
      users: users,
      total: users.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/admin/users - Crear nuevo usuario
router.post('/users', async (req, res) => {
  try {
    const { email, password, name, role_id, email_alerts, daily_predictions } = req.body;
    
    console.log('➕ Creando nuevo usuario:', { email, name, role_id });

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son obligatorios'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    if (role_id && role_id !== 1 && role_id !== 2) {
      return res.status(400).json({
        success: false,
        error: 'role_id debe ser 1 (usuario) o 2 (admin)'
      });
    }

    // Importar función de registro
    const { registerUser } = require('../auth/auth');
    
    // Crear usuario con confirmación automática
    const result = await registerUser(
      email, 
      password, 
      role_id || 1, 
      name || null,
      true, // is_confirmed = true (usuario creado por admin)
      email_alerts || false,
      daily_predictions || false
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Obtener datos completos del usuario creado
    const { getUserById } = require('../database/db');
    const newUser = await getUserById(result.user.id);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: newUser
    });
  } catch (error) {
    console.error('❌ Error creando usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// PUT /api/admin/users/:userId/role - Cambiar rol de usuario
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role_id } = req.body;

    console.log('🔄 Cambiando rol de usuario:', { userId, role_id });

    if (!role_id || (role_id !== 1 && role_id !== 2)) {
      return res.status(400).json({
        success: false,
        error: 'role_id debe ser 1 (usuario) o 2 (admin)'
      });
    }

    const result = await updateUserRole(userId, role_id);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente',
      user: result.user
    });
  } catch (error) {
    console.error('❌ Error cambiando rol:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// DELETE /api/admin/users/:userId - Eliminar usuario
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🗑️ Eliminando usuario:', userId);
    
    // No permitir eliminar el propio usuario admin
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'No puedes eliminar tu propia cuenta de administrador'
      });
    }

    const result = await deleteUser(userId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// PUT /api/admin/users/:userId/notifications - Actualizar notificaciones de usuario
router.put('/users/:userId/notifications', async (req, res) => {
  try {
    const { userId } = req.params;
    const { email_alerts, daily_predictions } = req.body;

    console.log('🔔 Actualizando notificaciones:', { userId, email_alerts, daily_predictions });

    if (typeof email_alerts !== 'boolean' || typeof daily_predictions !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'email_alerts y daily_predictions deben ser valores booleanos'
      });
    }

    const result = await updateUserNotifications(userId, email_alerts, daily_predictions);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Notificaciones actualizadas exitosamente',
      user: result.user
    });
  } catch (error) {
    console.error('❌ Error actualizando notificaciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/admin/dashboard - Estadísticas del dashboard
router.get('/dashboard', async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del dashboard admin...');
    const stats = await getAdminDashboardStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Función para determinar el estado de PM2.5
function getPM25State(value) {
  if (value <= 12) return 'Buena';
  if (value <= 35) return 'Regular';
  if (value <= 55) return 'Insalubre para grupos sensibles';
  if (value <= 150) return 'Insalubre';
  if (value <= 250) return 'Muy insalubre';
  return 'Peligrosa';
}

// Función para determinar el estado de otros parámetros
function getParameterState(param, value) {
  if (param === 'pm25') return getPM25State(value);
  if (value <= 50) return 'Buena';
  if (value <= 100) return 'Regular';
  if (value <= 150) return 'Insalubre para grupos sensibles';
  return 'Insalubre';
}

// Endpoint para arreglar datos de producción
router.post('/fix-production-data', async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando arreglo de datos de producción...');
    
    // 1. Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    await client.query('DELETE FROM promedios_diarios');
    
    // 2. Leer CSV
    console.log('📊 Leyendo CSV...');
    const csvPath = path.join(__dirname, '../../constitucion_asturias_air_quality_20250614.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log(`📈 CSV leído: ${lines.length} líneas`);
    
    // 3. Procesar datos
    const headers = lines[0].split(',').map(h => h.trim());
    const dataLines = lines.slice(1);
    
    let insertedCount = 0;
    
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      const columns = line.split(',').map(col => col.trim());
      const fecha = columns[0];
      
      if (!fecha || fecha === 'date') continue;
      
      // Insertar cada parámetro como fila separada (formato correcto: minúsculas)
      const parameters = [
        { param: 'pm25', valor: parseFloat(columns[1]) },
        { param: 'pm10', valor: parseFloat(columns[2]) },
        { param: 'o3', valor: parseFloat(columns[3]) },
        { param: 'no2', valor: parseFloat(columns[4]) },
        { param: 'so2', valor: parseFloat(columns[5]) },
        { param: 'co', valor: parseFloat(columns[6]) }
      ];
      
      for (const { param, valor } of parameters) {
        if (!isNaN(valor) && valor > 0) {
          const estado = getParameterState(param, valor);
          
          await client.query(`
            INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          `, [fecha, param, valor, estado, 'csv_historical', `Datos históricos de ${param.toUpperCase()}`]);
          
          insertedCount++;
        }
      }
    }
    
    // 4. Verificar resultados
    const result = await client.query('SELECT COUNT(*) as total FROM promedios_diarios');
    const pm25Count = await client.query("SELECT COUNT(*) as total FROM promedios_diarios WHERE parametro = 'pm25'");
    const recentPM25 = await client.query(`
      SELECT fecha, valor FROM promedios_diarios 
      WHERE parametro = 'pm25' AND fecha >= '2025-06-09' 
      ORDER BY fecha DESC LIMIT 5
    `);
    
    console.log(`✅ Datos insertados correctamente:`);
    console.log(`   - Total registros: ${result.rows[0].total}`);
    console.log(`   - Registros PM2.5: ${pm25Count.rows[0].total}`);
    console.log(`   - Datos recientes PM2.5: ${recentPM25.rows.length}`);
    
    res.json({
      success: true,
      message: 'Datos de producción arreglados correctamente',
      stats: {
        totalRecords: parseInt(result.rows[0].total),
        pm25Records: parseInt(pm25Count.rows[0].total),
        recentPM25Records: recentPM25.rows.length,
        insertedRecords: insertedCount
      },
      recentPM25Data: recentPM25.rows
    });
    
  } catch (error) {
    console.error('❌ Error arreglando datos de producción:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;