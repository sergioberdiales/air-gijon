#!/usr/bin/env node

/**
 * Script para poblar promedios_diarios en PRODUCCIÓN desde CSV
 * Específicamente diseñado para ejecutarse en Render y cargar datos históricos
 * 
 * INSTRUCCIONES:
 * 1. Copiar este archivo al servidor de producción
 * 2. Copiar el CSV a la misma carpeta
 * 3. Ejecutar: node populate_production_from_csv.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos para producción
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

function convertirFecha(fechaCSV) {
  // Convertir "2025/5/1" a "2025-05-01"
  const [year, month, day] = fechaCSV.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function getEstadoPM25(valor) {
  if (valor <= 12) return 'Buena';
  if (valor <= 35) return 'Regular';
  if (valor <= 55) return 'Insalubre para grupos sensibles';
  if (valor <= 150) return 'Insalubre';
  if (valor <= 250) return 'Muy Insalubre';
  return 'Peligrosa';
}

async function poblarPromediosDiariosProduccion() {
  try {
    console.log('🚀 POBLANDO PROMEDIOS_DIARIOS EN PRODUCCIÓN');
    console.log('=' * 50);
    
    // Verificar conexión a base de datos
    const testQuery = await pool.query('SELECT NOW()');
    console.log(`✅ Conexión a BD exitosa: ${testQuery.rows[0].now}`);
    
    // Verificar tabla promedios_diarios
    const tableCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'promedios_diarios'
    `);
    console.log(`✅ Tabla promedios_diarios encontrada con ${tableCheck.rows.length} columnas`);
    
    // Buscar el archivo CSV en el directorio actual
    const csvFiles = [
      'constitucion_asturias_air_quality_20250614.csv',
      'constitucion_asturias_air_quality_20250611.csv',
      'constitucion_asturias_air_quality.csv',
      './modelos_prediccion/constitucion_asturias_air_quality_20250614.csv',
      './modelos_prediccion/constitucion_asturias_air_quality_20250611.csv'
    ];
    
    let csvPath = null;
    for (const file of csvFiles) {
      if (fs.existsSync(file)) {
        csvPath = file;
        break;
      }
    }
    
    if (!csvPath) {
      throw new Error(`❌ CSV no encontrado. Buscar archivos: ${csvFiles.join(', ')}`);
    }
    
    console.log(`📄 CSV encontrado: ${csvPath}`);
    
    // Leer CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Saltar header
    const dataLines = lines.slice(1).filter(line => line.trim());
    console.log(`📄 Total líneas en CSV: ${dataLines.length}`);
    
    // Filtrar desde 1 mayo 2025 hasta 13 junio 2025
    const fechaMinima = new Date('2025-05-01');
    const fechaMaxima = new Date('2025-06-13');
    
    let registrosInsertados = 0;
    let registrosActualizados = 0;
    let registrosOmitidos = 0;
    
    console.log('\n🔄 Procesando datos...');
    
    for (const line of dataLines) {
      if (!line.trim()) continue;
      
      const [fecha, pm25, pm10, o3, no2, so2, co] = line.split(',').map(col => col.trim());
      
      // Validar fecha
      if (!fecha || !pm25) {
        registrosOmitidos++;
        continue;
      }
      
      // Convertir fecha
      const fechaFormateada = convertirFecha(fecha);
      const fechaObj = new Date(fechaFormateada);
      
      // Filtrar rango de fechas
      if (fechaObj < fechaMinima || fechaObj > fechaMaxima) {
        continue; // Silenciosamente omitir fechas fuera del rango
      }
      
      // Validar PM2.5
      const valorPM25 = parseFloat(pm25);
      if (isNaN(valorPM25)) {
        console.log(`⚠️ PM2.5 inválido para ${fechaFormateada}: ${pm25}`);
        registrosOmitidos++;
        continue;
      }
      
      try {
        // Verificar si ya existe
        const existingCheck = await pool.query(`
          SELECT id FROM promedios_diarios 
          WHERE fecha = $1 AND parametro = $2 AND source = $3
        `, [fechaFormateada, 'pm25', 'csv_historical']);
        
        if (existingCheck.rows.length > 0) {
          // Actualizar existente
          await pool.query(`
            UPDATE promedios_diarios 
            SET valor = $1, estado = $2, updated_at = CURRENT_TIMESTAMP
            WHERE fecha = $3 AND parametro = $4 AND source = $5
          `, [
            valorPM25,
            getEstadoPM25(valorPM25),
            fechaFormateada,
            'pm25',
            'csv_historical'
          ]);
          
          registrosActualizados++;
          console.log(`🔄 ${fechaFormateada}: ${valorPM25} µg/m³ (${getEstadoPM25(valorPM25)}) - ACTUALIZADO`);
        } else {
          // Insertar nuevo
          await pool.query(`
            INSERT INTO promedios_diarios (
              fecha, 
              parametro, 
              valor, 
              estado,
              source,
              detalles
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            fechaFormateada,
            'pm25',
            valorPM25,
            getEstadoPM25(valorPM25),
            'csv_historical',
            'Datos históricos desde CSV - Estación Avenida Constitución'
          ]);
          
          registrosInsertados++;
          console.log(`✅ ${fechaFormateada}: ${valorPM25} µg/m³ (${getEstadoPM25(valorPM25)}) - INSERTADO`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando ${fechaFormateada}:`, error.message);
        registrosOmitidos++;
      }
    }
    
    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`✅ Registros insertados: ${registrosInsertados}`);
    console.log(`🔄 Registros actualizados: ${registrosActualizados}`);
    console.log(`⚠️ Registros omitidos: ${registrosOmitidos}`);
    
    // Verificar datos insertados
    const resultado = await pool.query(`
      SELECT 
        COUNT(*) as total,
        MIN(fecha) as fecha_min,
        MAX(fecha) as fecha_max,
        AVG(valor) as promedio_pm25
      FROM promedios_diarios
      WHERE parametro = 'pm25' 
        AND source = 'csv_historical'
        AND fecha >= '2025-05-01'
        AND fecha <= '2025-06-13'
    `);
    
    const stats = resultado.rows[0];
    console.log(`\n📈 ESTADÍSTICAS FINALES:`);
    console.log(`📅 Período: ${stats.fecha_min} a ${stats.fecha_max}`);
    console.log(`📊 Total registros: ${stats.total}`);
    console.log(`🌬️ PM2.5 promedio: ${parseFloat(stats.promedio_pm25).toFixed(2)} µg/m³`);
    
    // Mostrar últimos registros para verificación
    const ultimosRegistros = await pool.query(`
      SELECT fecha, valor, estado 
      FROM promedios_diarios 
      WHERE parametro = 'pm25' AND source = 'csv_historical'
        AND fecha >= '2025-05-01' AND fecha <= '2025-06-13'
      ORDER BY fecha DESC 
      LIMIT 10
    `);
    
    console.log('\n📋 Últimos 10 registros insertados:');
    ultimosRegistros.rows.forEach(row => {
      const fecha = row.fecha.toISOString ? row.fecha.toISOString().split('T')[0] : row.fecha;
      console.log(`   ${fecha}: ${row.valor} µg/m³ (${row.estado})`);
    });
    
    console.log('\n🎉 ¡POBLACIÓN DE PROMEDIOS_DIARIOS COMPLETADA EN PRODUCCIÓN!');
    console.log('   La gráfica de evolución ahora debería mostrar los dados históricos.');
    
  } catch (error) {
    console.error('❌ Error poblando promedios_diarios en producción:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
if (require.main === module) {
  poblarPromediosDiariosProduccion();
}

module.exports = { poblarPromediosDiariosProduccion }; 