const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkJune10Specific() {
  try {
    console.log('🔍 Verificando registros específicos para 2025-06-10...\n');
    
    const result = await pool.query(`
      SELECT fecha, valor, estado, source, id
      FROM promedios_diarios 
      WHERE fecha = '2025-06-10' AND parametro = 'pm25'
      ORDER BY source
    `);
    
    console.log('📊 Todos los registros para 2025-06-10:');
    result.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`ID: ${row.id} | Fecha: ${fecha} | Valor: ${row.valor} µg/m³ | Source: ${row.source} | Estado: ${row.estado}`);
    });
    
    // Test the exact same query the endpoint uses
    console.log('\n🧪 Probando query exacta del endpoint...');
    const fechas = ['2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09', '2025-06-10'];
    
    const endpointQuery = await pool.query(`
      SELECT DISTINCT ON (fecha) fecha, parametro, valor, estado, source
      FROM promedios_diarios 
      WHERE fecha = ANY($1) AND parametro = $2
      ORDER BY fecha ASC, 
        CASE source 
          WHEN 'csv_historical' THEN 1
          WHEN 'csv_historico' THEN 2  
          WHEN 'mediciones_api' THEN 3
          WHEN 'calculated' THEN 4
          ELSE 5
        END
    `, [fechas, 'pm25']);
    
    console.log('\n📋 Resultado de query del endpoint:');
    endpointQuery.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`${fecha}: ${row.valor} µg/m³ (${row.source})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkJune10Specific(); 