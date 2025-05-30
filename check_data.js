const { pool } = require('./db');

async function checkData() {
  try {
    console.log('🔍 Verificando datos en la base de datos...\n');
    
    // Verificar qué parámetros tenemos
    const parametros = await pool.query(`
      SELECT parametro, COUNT(*) as cantidad, MAX(fecha) as ultima_fecha 
      FROM mediciones_api 
      WHERE estacion_id = '6699' 
      GROUP BY parametro 
      ORDER BY parametro
    `);
    
    console.log('📊 PARÁMETROS DISPONIBLES:');
    console.table(parametros.rows);
    
    // Verificar datos específicos de PM2.5
    const pm25Data = await pool.query(`
      SELECT fecha, valor 
      FROM mediciones_api 
      WHERE estacion_id = '6699' AND parametro = 'pm25' 
      ORDER BY fecha DESC 
      LIMIT 5
    `);
    
    console.log('\n🔬 ÚLTIMOS 5 DATOS DE PM2.5:');
    if (pm25Data.rows.length > 0) {
      console.table(pm25Data.rows);
    } else {
      console.log('❌ No hay datos de PM2.5 en la base de datos');
    }
    
    // Verificar datos específicos de PM10
    const pm10Data = await pool.query(`
      SELECT fecha, valor 
      FROM mediciones_api 
      WHERE estacion_id = '6699' AND parametro = 'pm10' 
      ORDER BY fecha DESC 
      LIMIT 5
    `);
    
    console.log('\n🔬 ÚLTIMOS 5 DATOS DE PM10:');
    if (pm10Data.rows.length > 0) {
      console.table(pm10Data.rows);
    } else {
      console.log('❌ No hay datos de PM10 en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkData(); 