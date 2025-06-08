#!/usr/bin/env node
/**
 * Genera datos adicionales de prueba en promedios_diarios
 * Para fechas 2025-06-04, 2025-06-05, 2025-06-06
 */

const { pool } = require('../db');

async function generateAdditionalTestData() {
  console.log('🔄 Generando datos adicionales de prueba...');
  
  const testData = [
    { fecha: '2025-06-04', valor: 18.5, estado_actual: 'Buena' },     // Miércoles
    { fecha: '2025-06-05', valor: 31.2, estado_actual: 'Regular' },  // Jueves 
    { fecha: '2025-06-06', valor: 28.7, estado_actual: 'Moderada' }  // Viernes
  ];
  
  try {
    for (const data of testData) {
      // Calcular estado OMS basado en valor PM2.5
      let estado_oms;
      if (data.valor <= 15) estado_oms = 'AQG';
      else if (data.valor <= 25) estado_oms = 'IT-4';
      else if (data.valor <= 37.5) estado_oms = 'IT-3';
      else if (data.valor <= 50) estado_oms = 'IT-2';
      else if (data.valor <= 75) estado_oms = 'IT-1';
      else estado_oms = '>IT-1';
      
      // Insertar registro (usando estructura actual de BD local)
      const result = await pool.query(`
        INSERT INTO promedios_diarios (
          fecha, parametro, valor, estado,
          created_at, updated_at
        ) VALUES (
          $1, 'pm25', $2, $3,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING fecha, valor, estado
      `, [data.fecha, data.valor, data.estado_actual]);
      
      console.log(`✅ ${result.rows[0].fecha.toISOString().split('T')[0]}: ${result.rows[0].valor} µg/m³ (${result.rows[0].estado})`);
    }
    
    // Verificar totales
    const count = await pool.query(`
      SELECT COUNT(*) as total, MIN(fecha) as primera, MAX(fecha) as ultima
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    
    console.log(`\n📊 Total datos PM2.5: ${count.rows[0].total} registros`);
    console.log(`📅 Rango: ${count.rows[0].primera.toISOString().split('T')[0]} a ${count.rows[0].ultima.toISOString().split('T')[0]}`);
    
    console.log('\n✅ Datos adicionales generados exitosamente');
    
  } catch (error) {
    console.error('❌ Error generando datos:', error);
    throw error;
  }
}

if (require.main === module) {
  generateAdditionalTestData()
    .then(() => {
      console.log('🎉 Proceso completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { generateAdditionalTestData }; 