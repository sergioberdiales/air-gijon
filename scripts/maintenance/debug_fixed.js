const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugFixed() {
  try {
    console.log('🔍 Debug: Con el código arreglado...\n');
    
    const fechas = [];
    const hoy = new Date();
    
    for (let i = 5; i >= 1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      fechas.push({
        fecha: fecha.toISOString().split('T')[0],
        tipo: 'historico'
      });
    }
    
    console.log('📅 Fechas buscadas:');
    fechas.forEach(f => console.log(`   ${f.fecha}`));
    
    const fechasHistoricas = fechas.map(f => f.fecha);
    const historicos = await pool.query(`
      SELECT DISTINCT ON (fecha) fecha, parametro, valor, estado, source
      FROM promedios_diarios 
      WHERE fecha::text = ANY($1) AND parametro = $2
      ORDER BY fecha ASC, 
        CASE source 
          WHEN 'csv_historical' THEN 1
          WHEN 'csv_historico' THEN 2  
          WHEN 'mediciones_api' THEN 3
          WHEN 'calculated' THEN 4
          ELSE 5
        END
    `, [fechasHistoricas, 'pm25']);
    
    console.log('\n📊 Datos devueltos por consulta:');
    historicos.rows.forEach(row => {
      const year = row.fecha.getFullYear();
      const month = String(row.fecha.getMonth() + 1).padStart(2, '0');
      const day = String(row.fecha.getDate()).padStart(2, '0');
      const fechaLocal = `${year}-${month}-${day}`;
      console.log(`   BD: ${row.fecha} → Local: ${fechaLocal} → Valor: ${row.valor}`);
    });
    
    console.log('\n🔍 Matching con lógica arreglada:');
    fechas.forEach(fechaInfo => {
      console.log(`\nBuscando: ${fechaInfo.fecha}`);
      
      const datos = historicos.rows.find(row => {
        const year = row.fecha.getFullYear();
        const month = String(row.fecha.getMonth() + 1).padStart(2, '0');
        const day = String(row.fecha.getDate()).padStart(2, '0');
        const fechaLocal = `${year}-${month}-${day}`;
        console.log(`  Comparando: ${fechaLocal} === ${fechaInfo.fecha} ? ${fechaLocal === fechaInfo.fecha}`);
        return fechaLocal === fechaInfo.fecha;
      });
      
      if (datos) {
        console.log(`   ✅ MATCH: ${datos.valor} µg/m³ (${datos.estado})`);
      } else {
        console.log(`   ❌ NO MATCH - se generaría placeholder o no se incluiría`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugFixed(); 