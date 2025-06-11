const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDates() {
  try {
    const result = await pool.query(`
      SELECT fecha, valor, source, id
      FROM promedios_diarios 
      WHERE parametro = 'pm25' AND source = 'csv_historical' 
      ORDER BY fecha DESC 
      LIMIT 15
    `);
    
    console.log('📅 Últimas fechas en promedios_diarios (csv_historical):');
    result.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`ID: ${row.id} | ${fecha}: ${row.valor} µg/m³ (${row.source})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDates(); 