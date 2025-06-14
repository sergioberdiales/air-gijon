const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require(path.resolve(__dirname, './database/db.js'));
const { ensureAdminUser } = require(path.resolve(__dirname, './auth/auth.js'));
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ENDPOINT PÚBLICO DE MANTENIMIENTO - SIN AUTENTICACIÓN
app.post('/maintenance/fix-production-data', async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Iniciando arreglo de datos de producción...');
    
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
    
    // 1. Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    await client.query('DELETE FROM promedios_diarios');
    
    // 2. Leer CSV
    console.log('📊 Leyendo CSV...');
    const csvPath = path.join(__dirname, '../constitucion_asturias_air_quality_20250614.csv');
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

// Path relative from src -> root -> frontend/dist
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const apiRoutes = require(path.resolve(__dirname, './routes/index.js'));
app.use('/api', apiRoutes);

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