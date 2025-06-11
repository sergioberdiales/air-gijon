const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanKeepOnlyCSV() {
  try {
    console.log('🧹 Limpiando para mantener solo datos csv_historical...\n');
    
    // First, show all data in the range we care about
    const allDataQuery = await pool.query(`
      SELECT fecha, parametro, valor, estado, source, id
      FROM promedios_diarios 
      WHERE fecha >= '2025-05-01' AND fecha <= '2025-06-10'
      AND parametro = 'pm25'
      ORDER BY fecha DESC, source
    `);
    
    console.log('📋 Todos los registros en el rango 2025-05-01 a 2025-06-10:');
    allDataQuery.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`ID: ${row.id} | ${fecha} | ${row.valor} µg/m³ | ${row.source}`);
    });
    
    // Count by source
    const sourceCountQuery = await pool.query(`
      SELECT source, COUNT(*) as count
      FROM promedios_diarios 
      WHERE fecha >= '2025-05-01' AND fecha <= '2025-06-10'
      AND parametro = 'pm25'
      GROUP BY source
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Registros por fuente:');
    sourceCountQuery.rows.forEach(row => {
      console.log(`${row.source}: ${row.count} registros`);
    });
    
    // Delete all non-csv_historical records in our date range
    const deleteQuery = await pool.query(`
      DELETE FROM promedios_diarios 
      WHERE fecha >= '2025-05-01' AND fecha <= '2025-06-10'
      AND parametro = 'pm25'
      AND source != 'csv_historical'
      RETURNING id, fecha, source
    `);
    
    console.log(`\n✅ Eliminados ${deleteQuery.rowCount} registros que no eran csv_historical:`);
    deleteQuery.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`  - ID ${row.id}: ${fecha} (${row.source})`);
    });
    
    // Show final state
    const finalQuery = await pool.query(`
      SELECT fecha, parametro, valor, estado, source 
      FROM promedios_diarios 
      WHERE fecha >= '2025-05-01' AND fecha <= '2025-06-10'
      AND parametro = 'pm25'
      ORDER BY fecha DESC
    `);
    
    console.log('\n📊 Estado final - solo datos csv_historical:');
    console.log('Fecha\t\tValor\tEstado\t\t\tSource');
    console.log('='.repeat(80));
    finalQuery.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`${fecha}\t${row.valor}\t${row.estado.padEnd(20)}\t${row.source}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanKeepOnlyCSV(); 