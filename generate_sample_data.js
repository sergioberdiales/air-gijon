#!/usr/bin/env node

// Script para generar datos de muestra en promedios_diarios
// Útil para testing y asegurar que el sistema tenga datos básicos

const { pool } = require('./db');

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

async function generateSampleData() {
  try {
    console.log('🔄 Generando datos de muestra para promedios_diarios...');
    
    const hoy = new Date();
    const datos = [];
    
    // Generar 10 días históricos (hace 10 días hasta ayer)
    for (let i = 10; i >= 1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Valores realistas de PM2.5 para históricos
      const valor = Math.round((12 + Math.random() * 8) * 100) / 100; // 12-20 µg/m³
      const estado = getEstadoPM25(valor);
      
      datos.push({
        fecha: fechaStr,
        pm25_promedio: valor,
        tipo: 'historico',
        confianza: 0.85,
        estado: estado
      });
    }
    
    // Generar predicciones para hoy y mañana
    for (let i = 0; i <= 1; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Valores realistas para predicciones
      const valor = Math.round((15 + Math.random() * 10) * 100) / 100; // 15-25 µg/m³
      const estado = getEstadoPM25(valor);
      
      datos.push({
        fecha: fechaStr,
        pm25_promedio: valor,
        tipo: 'prediccion',
        confianza: 0.75,
        estado: estado
      });
    }
    
    console.log(`📊 Insertando ${datos.length} registros...`);
    
    // Insertar datos usando upsert para evitar duplicados
    for (const dato of datos) {
      const query = `
        INSERT INTO promedios_diarios (fecha, pm25_promedio, tipo, confianza, pm25_estado, source)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (fecha) DO UPDATE SET
          pm25_promedio = EXCLUDED.pm25_promedio,
          tipo = EXCLUDED.tipo,
          confianza = EXCLUDED.confianza,
          pm25_estado = EXCLUDED.pm25_estado,
          source = EXCLUDED.source,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await pool.query(query, [
        dato.fecha,
        dato.pm25_promedio,
        dato.tipo,
        dato.confianza,
        dato.estado,
        'sample_generator'
      ]);
    }
    
    console.log('✅ Datos de muestra generados exitosamente');
    
    // Mostrar resumen
    const resumen = await pool.query(`
      SELECT tipo, COUNT(*) as cantidad, MIN(fecha) as desde, MAX(fecha) as hasta
      FROM promedios_diarios
      WHERE source = 'sample_generator'
      GROUP BY tipo
      ORDER BY tipo
    `);
    
    console.log('\n📋 Resumen de datos generados:');
    resumen.rows.forEach(row => {
      console.log(`   ${row.tipo}: ${row.cantidad} registros (${row.desde} a ${row.hasta})`);
    });
    
    // Mostrar datos recientes
    const recientes = await pool.query(`
      SELECT fecha, pm25_promedio, tipo, pm25_estado
      FROM promedios_diarios
      ORDER BY fecha DESC
      LIMIT 7
    `);
    
    console.log('\n📅 Últimos 7 registros:');
    recientes.rows.forEach(row => {
      console.log(`   ${row.fecha}: ${row.pm25_promedio} µg/m³ (${row.tipo}, ${row.pm25_estado})`);
    });
    
    console.log('\n🎯 Listo para probar el endpoint /api/air/constitucion/evolucion');
    
  } catch (error) {
    console.error('❌ Error generando datos:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  generateSampleData();
}

module.exports = { generateSampleData }; 