#!/usr/bin/env node

/**
 * Script para cargar datos históricos de PM2.5 en PRODUCCIÓN
 * Datos embebidos para evitar problemas de transferencia de archivos
 * Ejecutar en Render: node load_production_data.js
 */

const { Pool } = require('pg');

// Configuración de base de datos para producción
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function getEstadoPM25(valor) {
  if (valor <= 12) return 'Buena';
  if (valor <= 35) return 'Regular';
  if (valor <= 55) return 'Insalubre para grupos sensibles';
  if (valor <= 150) return 'Insalubre';
  if (valor <= 250) return 'Muy Insalubre';
  return 'Peligrosa';
}

// Datos históricos de PM2.5 desde el 1 de mayo al 10 de junio 2025
const datosHistoricos = [
  { fecha: '2025-05-01', pm25: 21 },
  { fecha: '2025-05-02', pm25: 35 },
  { fecha: '2025-05-03', pm25: 25 },
  { fecha: '2025-05-04', pm25: 26 },
  { fecha: '2025-05-05', pm25: 26 },
  { fecha: '2025-05-06', pm25: 30 },
  { fecha: '2025-05-07', pm25: 27 },
  { fecha: '2025-05-08', pm25: 43 },
  { fecha: '2025-05-09', pm25: 29 },
  { fecha: '2025-05-10', pm25: 30 },
  { fecha: '2025-05-11', pm25: 26 },
  { fecha: '2025-05-12', pm25: 27 },
  { fecha: '2025-05-13', pm25: 22 },
  { fecha: '2025-05-14', pm25: 27 },
  { fecha: '2025-05-15', pm25: 26 },
  { fecha: '2025-05-16', pm25: 44 },
  { fecha: '2025-05-17', pm25: 37 },
  { fecha: '2025-05-18', pm25: 48 },
  { fecha: '2025-05-19', pm25: 33 },
  { fecha: '2025-05-20', pm25: 37 },
  { fecha: '2025-05-21', pm25: 45 },
  { fecha: '2025-05-22', pm25: 26 },
  { fecha: '2025-05-23', pm25: 28 },
  { fecha: '2025-05-24', pm25: 29 },
  { fecha: '2025-05-25', pm25: 34 },
  { fecha: '2025-05-26', pm25: 22 },
  { fecha: '2025-05-27', pm25: 23 },
  { fecha: '2025-05-28', pm25: 37 },
  { fecha: '2025-05-29', pm25: 40 },
  { fecha: '2025-05-30', pm25: 44 },
  { fecha: '2025-05-31', pm25: 21 },
  { fecha: '2025-06-01', pm25: 26 },
  { fecha: '2025-06-02', pm25: 24 },
  { fecha: '2025-06-03', pm25: 24 },
  { fecha: '2025-06-04', pm25: 32 },
  { fecha: '2025-06-05', pm25: 29 },
  { fecha: '2025-06-06', pm25: 27 },
  { fecha: '2025-06-07', pm25: 26 },
  { fecha: '2025-06-08', pm25: 37 },
  { fecha: '2025-06-09', pm25: 47 },
  { fecha: '2025-06-10', pm25: 48 }
];

async function cargarDatosProduccion() {
  try {
    console.log('🚀 CARGANDO DATOS HISTÓRICOS EN PRODUCCIÓN');
    console.log('================================================');
    
    // Verificar conexión
    const testQuery = await pool.query('SELECT NOW()');
    console.log(`✅ Conexión exitosa: ${testQuery.rows[0].now}`);
    
    // Verificar tabla
    const tableCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'promedios_diarios'
    `);
    console.log(`✅ Tabla promedios_diarios existe (${tableCheck.rows.length} columnas)`);
    
    let insertados = 0;
    let actualizados = 0;
    let errores = 0;
    
    console.log('\n🔄 Procesando datos...');
    
    for (const dato of datosHistoricos) {
      try {
        // Verificar si ya existe
        const existing = await pool.query(`
          SELECT id FROM promedios_diarios 
          WHERE fecha = $1 AND parametro = $2
        `, [dato.fecha, 'pm25']);
        
        const estado = getEstadoPM25(dato.pm25);
        
        if (existing.rows.length > 0) {
          // Actualizar
          await pool.query(`
            UPDATE promedios_diarios 
            SET valor = $1, estado = $2, source = $3, updated_at = CURRENT_TIMESTAMP
            WHERE fecha = $4 AND parametro = $5
          `, [dato.pm25, estado, 'csv_historical', dato.fecha, 'pm25']);
          
          actualizados++;
          console.log(`🔄 ${dato.fecha}: ${dato.pm25} µg/m³ (${estado}) - ACTUALIZADO`);
        } else {
          // Insertar
          await pool.query(`
            INSERT INTO promedios_diarios (
              fecha, parametro, valor, estado, source, detalles
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            dato.fecha,
            'pm25',
            dato.pm25,
            estado,
            'csv_historical',
            'Datos históricos - Estación Avenida Constitución'
          ]);
          
          insertados++;
          console.log(`✅ ${dato.fecha}: ${dato.pm25} µg/m³ (${estado}) - INSERTADO`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando ${dato.fecha}:`, error.message);
        errores++;
      }
    }
    
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`✅ Registros insertados: ${insertados}`);
    console.log(`🔄 Registros actualizados: ${actualizados}`);
    console.log(`❌ Errores: ${errores}`);
    
    // Verificar resultados
    const resultado = await pool.query(`
      SELECT 
        COUNT(*) as total,
        MIN(fecha) as fecha_min,
        MAX(fecha) as fecha_max,
        AVG(valor) as promedio_pm25
      FROM promedios_diarios
      WHERE parametro = 'pm25' 
        AND fecha >= '2025-05-01'
        AND fecha <= '2025-06-10'
    `);
    
    const stats = resultado.rows[0];
    console.log('\n📈 ESTADÍSTICAS:');
    console.log(`📅 Período: ${stats.fecha_min} a ${stats.fecha_max}`);
    console.log(`📊 Total registros: ${stats.total}`);
    console.log(`🌬️ PM2.5 promedio: ${parseFloat(stats.promedio_pm25).toFixed(2)} µg/m³`);
    
    // Mostrar algunos registros recientes
    const recientes = await pool.query(`
      SELECT fecha, valor, estado 
      FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha >= '2025-06-05'
      ORDER BY fecha DESC
    `);
    
    console.log('\n📋 Registros más recientes:');
    recientes.rows.forEach(row => {
      const fecha = typeof row.fecha === 'string' ? row.fecha : row.fecha.toISOString().split('T')[0];
      console.log(`   ${fecha}: ${row.valor} µg/m³ (${row.estado})`);
    });
    
    console.log('\n🎉 ¡CARGA COMPLETADA!');
    console.log('   La gráfica de evolución ahora debería mostrar los datos históricos.');
    console.log('   Ve a https://air-gijon.onrender.com para verificar.');
    
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  cargarDatosProduccion();
}

module.exports = { cargarDatosProduccion }; 