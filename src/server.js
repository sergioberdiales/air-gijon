const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require(path.resolve(__dirname, './database/db.js'));
const { ensureAdminUser } = require(path.resolve(__dirname, './auth/auth.js'));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Path relative from src -> root -> frontend/dist
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const apiRoutes = require(path.resolve(__dirname, './routes/index.js'));
app.use('/api', apiRoutes);

// Endpoint temporal de debug para datos PM2.5
app.get('/debug/pm25-data', async (req, res) => {
  try {
    console.log('🔄 Debug endpoint: Verificando datos PM2.5...');
    
    // 1. Contar total de registros PM2.5
    const countQuery = await pool.query(`
      SELECT COUNT(*) as total
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    
    // 2. Fechas disponibles (primeras y últimas)
    const datesQuery = await pool.query(`
      SELECT MIN(fecha) as primera_fecha, MAX(fecha) as ultima_fecha
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    
    // 3. Datos disponibles hasta 2025-06-15 (fecha del cron job que falló)
    const beforeTargetQuery = await pool.query(`
      SELECT COUNT(*) as count_before_target
      FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha < '2025-06-15'
    `);
    
    // 4. Últimos 10 registros para verificar
    const recentQuery = await pool.query(`
      SELECT fecha, valor
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      ORDER BY fecha DESC
      LIMIT 10
    `);
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      total_registros_pm25: parseInt(countQuery.rows[0].total),
      primera_fecha: datesQuery.rows[0].primera_fecha,
      ultima_fecha: datesQuery.rows[0].ultima_fecha,
      registros_antes_2025_06_15: parseInt(beforeTargetQuery.rows[0].count_before_target),
      ultimos_registros: recentQuery.rows,
      problema_identificado: parseInt(beforeTargetQuery.rows[0].count_before_target) < 28 ? 
        'Insuficientes datos históricos antes de 2025-06-15' : 'Datos suficientes disponibles'
    };
    
    console.log('📊 Debug info:', JSON.stringify(debugInfo, null, 2));
    res.json(debugInfo);
    
  } catch (error) {
    console.error('❌ Error en debug endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint temporal para optimizar base de datos (solo PM2.5 desde mayo 2025)
app.post('/maintenance/optimize-database', async (req, res) => {
  try {
    console.log('🔄 Optimización endpoint: Limpiando base de datos...');
    
    // 1. Estado actual
    const currentStatsQuery = await pool.query(`
      SELECT 
        parametro,
        COUNT(*) as total,
        MIN(fecha) as primera_fecha,
        MAX(fecha) as ultima_fecha
      FROM promedios_diarios 
      GROUP BY parametro
      ORDER BY parametro
    `);
    
    // 2. Eliminar parámetros que no sean PM2.5
    const deleteOtherParams = await pool.query(`
      DELETE FROM promedios_diarios 
      WHERE parametro != 'pm25'
    `);
    
    // 3. Eliminar datos de PM2.5 anteriores al 1 de mayo de 2025
    const deleteOldPM25 = await pool.query(`
      DELETE FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha < '2025-05-01'
    `);
    
    // 4. Estado después de optimización
    const optimizedStatsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_pm25,
        MIN(fecha) as primera_fecha,
        MAX(fecha) as ultima_fecha
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    
    // 5. Verificar datos antes del 15 de junio
    const beforeCronQuery = await pool.query(`
      SELECT COUNT(*) as count_before_cron
      FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha < '2025-06-15'
    `);
    
    const optimizationResult = {
      timestamp: new Date().toISOString(),
      datos_antes: currentStatsQuery.rows,
      eliminados_otros_parametros: deleteOtherParams.rowCount,
      eliminados_pm25_antiguos: deleteOldPM25.rowCount,
      datos_despues: optimizedStatsQuery.rows[0],
      registros_antes_2025_06_15: parseInt(beforeCronQuery.rows[0].count_before_cron),
      cron_deberia_funcionar: parseInt(beforeCronQuery.rows[0].count_before_cron) >= 28,
      message: 'Optimización completada exitosamente'
    };
    
    console.log('🎉 Optimización completada:', JSON.stringify(optimizationResult, null, 2));
    res.json(optimizationResult);
    
  } catch (error) {
    console.error('❌ Error en optimización:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Error durante la optimización de la base de datos'
    });
  }
});

// Fallback for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('🐘 Conexión con PostgreSQL exitosa');
    await ensureAdminUser();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app; 