const { Pool } = require('pg');

// Configuración para producción
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function debugProductionData() {
  try {
    console.log('🔄 Conectando a base de datos de producción...');
    
    // Verificar conexión
    const testQuery = await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa:', testQuery.rows[0].now);
    
    // 1. Contar total de registros PM2.5
    const countQuery = await pool.query(`
      SELECT COUNT(*) as total
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    console.log(`📊 Total registros PM2.5: ${countQuery.rows[0].total}`);
    
    // 2. Fechas disponibles (primeras y últimas)
    const datesQuery = await pool.query(`
      SELECT MIN(fecha) as primera_fecha, MAX(fecha) as ultima_fecha
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    console.log(`📅 Rango de fechas: ${datesQuery.rows[0].primera_fecha} hasta ${datesQuery.rows[0].ultima_fecha}`);
    
    // 3. Datos disponibles hasta 2025-06-15 (fecha del cron job que falló)
    const beforeTargetQuery = await pool.query(`
      SELECT COUNT(*) as count_before_target
      FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha < '2025-06-15'
    `);
    console.log(`🎯 Registros PM2.5 antes del 2025-06-15: ${beforeTargetQuery.rows[0].count_before_target}`);
    
    // 4. Últimos 10 registros para verificar
    const recentQuery = await pool.query(`
      SELECT fecha, valor
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      ORDER BY fecha DESC
      LIMIT 10
    `);
    console.log('🔍 Últimos 10 registros PM2.5:');
    recentQuery.rows.forEach(row => {
      console.log(`   ${row.fecha}: ${row.valor} µg/m³`);
    });
    
    // 5. Registros por mes para ver distribución
    const monthlyQuery = await pool.query(`
      SELECT 
        DATE_TRUNC('month', fecha) as mes,
        COUNT(*) as registros
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      GROUP BY DATE_TRUNC('month', fecha)
      ORDER BY mes DESC
    `);
    console.log('📊 Distribución por mes:');
    monthlyQuery.rows.forEach(row => {
      const mes = new Date(row.mes).toISOString().substr(0, 7);
      console.log(`   ${mes}: ${row.registros} registros`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Verificar que estamos en producción
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no encontrada. Este script es solo para producción.');
  process.exit(1);
}

debugProductionData(); 