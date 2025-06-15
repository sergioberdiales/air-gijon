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