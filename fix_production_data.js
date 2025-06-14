const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración para producción (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
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
  return 'Insalubre';
}

async function fixProductionData() {
  try {
    console.log('🔄 Conectando a base de datos de producción...');
    
    // Verificar conexión
    const testQuery = await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa:', testQuery.rows[0].now);
    
    console.log('🧹 Limpiando datos existentes...');
    const deleteResult = await pool.query('DELETE FROM promedios_diarios');
    console.log(`🗑️ Eliminados ${deleteResult.rowCount} registros`);
    
    console.log('📊 Leyendo CSV...');
    const csvPath = path.join(__dirname, 'constitucion_asturias_air_quality_20250614.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Saltar la primera línea (headers)
    const dataLines = lines.slice(1);
    console.log(`📈 Procesando ${dataLines.length} líneas de datos...`);
    
    let insertedCount = 0;
    
    for (const line of dataLines) {
      const columns = line.split(',').map(col => col.trim());
      
      if (columns.length < 7) continue;
      
      const dateStr = columns[0];
      const pm25 = columns[1] ? parseFloat(columns[1]) : null;
      const pm10 = columns[2] ? parseFloat(columns[2]) : null;
      const o3 = columns[3] ? parseFloat(columns[3]) : null;
      const no2 = columns[4] ? parseFloat(columns[4]) : null;
      const so2 = columns[5] ? parseFloat(columns[5]) : null;
      const co = columns[6] ? parseFloat(columns[6]) : null;
      
      // Convertir fecha de formato YYYY/M/D a YYYY-MM-DD
      const [year, month, day] = dateStr.split('/');
      const fecha = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Insertar cada parámetro como una fila separada (formato normalizado)
      const parameters = [
        { param: 'pm25', valor: pm25 },
        { param: 'pm10', valor: pm10 },
        { param: 'o3', valor: o3 },
        { param: 'no2', valor: no2 },
        { param: 'so2', valor: so2 },
        { param: 'co', valor: co }
      ];
      
      for (const { param, valor } of parameters) {
        if (valor !== null && !isNaN(valor)) {
          const estado = getParameterState(param, valor);
          
          await pool.query(`
            INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [fecha, param, valor, estado, 'csv_historical', 'Datos históricos Estación Constitución']);
          
          insertedCount++;
        }
      }
    }
    
    console.log(`✅ Insertados ${insertedCount} registros`);
    
    // Verificar los datos insertados
    const result = await pool.query(`
      SELECT parametro, COUNT(*) as count 
      FROM promedios_diarios 
      GROUP BY parametro 
      ORDER BY parametro
    `);
    
    console.log('📊 Resumen de datos insertados:');
    result.rows.forEach(row => {
      console.log(`   ${row.parametro}: ${row.count} registros`);
    });
    
    // Verificar PM2.5 específicamente
    const pm25Check = await pool.query(`
      SELECT COUNT(*) as count, MIN(fecha) as min_fecha, MAX(fecha) as max_fecha
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    
    console.log(`🎯 PM2.5: ${pm25Check.rows[0].count} registros desde ${pm25Check.rows[0].min_fecha} hasta ${pm25Check.rows[0].max_fecha}`);
    
    // Verificar datos recientes para PM2.5
    const recentPM25 = await pool.query(`
      SELECT fecha, valor 
      FROM promedios_diarios 
      WHERE parametro = 'pm25' AND fecha >= '2025-06-09' 
      ORDER BY fecha
    `);
    
    console.log('🔍 Datos PM2.5 recientes (para evolución):');
    recentPM25.rows.forEach(row => {
      console.log(`   ${row.fecha}: ${row.valor}`);
    });
    
    console.log('🎉 ¡Datos de producción actualizados correctamente!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Verificar que estamos en producción
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no encontrada. Este script es solo para producción.');
  process.exit(1);
}

fixProductionData(); 