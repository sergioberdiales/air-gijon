const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("../middleware/adminAuth");
const { getAllUsers, updateUserRole, getAdminDashboardStats, getRoles, deleteUser, updateUserNotifications } = require("../database/db");

router.use(requireAuth);
router.use(requireAdmin);

// Dashboard stats
router.get("/dashboard", async (req, res) => {
  try {
    const stats = await getAdminDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error obteniendo stats:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// Obtener todos los usuarios
router.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    res.status(500).json({ error: "Error obteniendo usuarios" });
  }
});

// Cambiar rol de usuario
router.put("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: "role_id es requerido" });
    }

    const updatedUser = await updateUserRole(id, role_id);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error actualizando rol:", error);
    res.status(500).json({ error: "Error actualizando rol de usuario" });
  }
});

// Eliminar usuario
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que no se elimine a sí mismo
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    }

    const result = await deleteUser(id);
    res.json({ success: true, message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    res.status(500).json({ error: "Error eliminando usuario" });
  }
});

// Gestionar notificaciones de usuario
router.put("/users/:id/notifications", async (req, res) => {
  try {
    const { id } = req.params;
    const { email_alerts, daily_predictions } = req.body;

    const updatedUser = await updateUserNotifications(id, email_alerts, daily_predictions);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error actualizando notificaciones:", error);
    res.status(500).json({ error: "Error actualizando notificaciones" });
  }
});

// Obtener roles
router.get("/roles", async (req, res) => {
  try {
    const roles = await getRoles();
    res.json({ success: true, roles });
  } catch (error) {
    console.error("Error obteniendo roles:", error);
    res.status(500).json({ error: "Error obteniendo roles" });
  }
});

// Endpoint temporal para poblar datos históricos en producción
router.post('/populate-production', requireAdmin, async (req, res) => {
  try {
    console.log('🚀 Iniciando población de datos históricos en producción...');
    
    // Importar y ejecutar el script de población
    const path = require('path');
    const fs = require('fs');
    
    // Verificar que estamos en producción
    if (!process.env.DATABASE_URL || process.env.NODE_ENV !== 'production') {
      return res.status(400).json({
        success: false,
        error: 'Este endpoint solo funciona en producción'
      });
    }
    
    // Verificar que existe el archivo CSV
    const csvPath = path.join(__dirname, '../../constitucion_asturias_air_quality_20250614.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(400).json({
        success: false,
        error: 'Archivo CSV no encontrado: constitucion_asturias_air_quality_20250614.csv'
      });
    }
    
    // Ejecutar el script de población
    const { Pool } = require('pg');
    const csv = require('csv-parser');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    let processedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Leer y procesar CSV
    const csvData = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Procesando ${csvData.length} filas del CSV...`);
    
    for (const row of csvData) {
      try {
        processedCount++;
        
        // Parsear fecha (formato DD/MM/YYYY)
        const [day, month, year] = row.fecha.split('/');
        const fecha = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        // Validar fecha (solo procesar desde mayo 2025)
        const fechaObj = new Date(fecha);
        const mayoInicio = new Date('2025-05-01');
        const junioFin = new Date('2025-06-13');
        
        if (fechaObj < mayoInicio || fechaObj > junioFin) {
          continue; // Saltar fechas fuera del rango
        }
        
        // Parsear valores numéricos
        const pm25 = parseFloat(row.pm25) || null;
        const pm10 = parseFloat(row.pm10) || null;
        const no2 = parseFloat(row.no2) || null;
        const o3 = parseFloat(row.o3) || null;
        const so2 = parseFloat(row.so2) || null;
        const co = parseFloat(row.co) || null;
        
        // Verificar si ya existe el registro
        const existingQuery = `
          SELECT id FROM promedios_diarios 
          WHERE fecha = $1 AND fuente = 'csv_historical'
        `;
        const existingResult = await pool.query(existingQuery, [fecha]);
        
        if (existingResult.rows.length > 0) {
          // Actualizar registro existente
          const updateQuery = `
            UPDATE promedios_diarios 
            SET pm25 = $2, pm10 = $3, no2 = $4, o3 = $5, so2 = $6, co = $7,
                actualizado_en = CURRENT_TIMESTAMP
            WHERE fecha = $1 AND fuente = 'csv_historical'
          `;
          await pool.query(updateQuery, [fecha, pm25, pm10, no2, o3, so2, co]);
          updatedCount++;
        } else {
          // Insertar nuevo registro
          const insertQuery = `
            INSERT INTO promedios_diarios (fecha, pm25, pm10, no2, o3, so2, co, fuente, creado_en, actualizado_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'csv_historical', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
          await pool.query(insertQuery, [fecha, pm25, pm10, no2, o3, so2, co]);
          insertedCount++;
        }
        
        // Log cada 10 registros procesados
        if (processedCount % 10 === 0) {
          console.log(`📈 Procesados: ${processedCount}, Insertados: ${insertedCount}, Actualizados: ${updatedCount}`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error procesando fila ${processedCount}:`, error.message);
      }
    }
    
    await pool.end();
    
    const summary = {
      success: true,
      processed: processedCount,
      inserted: insertedCount,
      updated: updatedCount,
      errors: errorCount,
      message: `Población completada: ${insertedCount} insertados, ${updatedCount} actualizados, ${errorCount} errores`
    };
    
    console.log('✅ Población de datos históricos completada:', summary);
    
    res.json(summary);
    
  } catch (error) {
    console.error('❌ Error en población de datos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 