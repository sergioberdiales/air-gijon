#!/usr/bin/env node

// Cargar configuración del proyecto
require('dotenv').config();
const { pool } = require('../../src/database/db.js');
const fs = require('fs');
const path = require('path');

/**
 * Script para poblar promedios_diarios desde CSV de calidad del aire
 * Convierte datos históricos reales desde 1 mayo 2025
 */

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

async function poblarPromediosDiarios() {
  try {
    console.log('📊 Poblando promedios_diarios desde CSV...');
    
    // Ruta al CSV
    const csvPath = path.join(process.cwd(), 'modelos_prediccion/constitucion_asturias_air_quality_20250614.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV no encontrado: ${csvPath}`);
    }
    
    // Leer CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Saltar header
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📄 Total líneas en CSV: ${dataLines.length}`);
    
    // Filtrar desde 1 mayo 2025 hasta 14 junio 2025
    const fechaMinima = new Date('2025-05-01');
    const fechaMaxima = new Date('2025-06-14'); // Incluir hasta el 14 de junio
    
    let registrosInsertados = 0;
    let registrosOmitidos = 0;
    
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
        // Insertar en promedios_diarios
        await pool.query(`
          INSERT INTO promedios_diarios (
            fecha, 
            parametro, 
            valor, 
            estado,
            source,
            detalles
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (fecha, parametro, source) 
          DO UPDATE SET
            valor = EXCLUDED.valor,
            estado = EXCLUDED.estado,
            updated_at = CURRENT_TIMESTAMP
        `, [
          fechaFormateada,
          'pm25',
          valorPM25,
          getEstadoPM25(valorPM25),
          'csv_historical',
          `Datos históricos desde CSV - Estación Avenida Constitución`
        ]);
        
        registrosInsertados++;
        console.log(`✅ ${fechaFormateada}: ${valorPM25} µg/m³ (${getEstadoPM25(valorPM25)})`);
        
      } catch (error) {
        console.error(`❌ Error insertando ${fechaFormateada}:`, error.message);
        registrosOmitidos++;
      }
    }
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`✅ Registros insertados: ${registrosInsertados}`);
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
    `);
    
    const stats = resultado.rows[0];
    console.log(`\n📈 ESTADÍSTICAS:`);
    console.log(`📅 Período: ${stats.fecha_min} a ${stats.fecha_max}`);
    console.log(`📊 Total registros: ${stats.total}`);
    console.log(`🌬️ PM2.5 promedio: ${parseFloat(stats.promedio_pm25).toFixed(2)} µg/m³`);
    
    console.log('\n✅ Población de promedios_diarios completada');
    
  } catch (error) {
    console.error('❌ Error poblando promedios_diarios:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  poblarPromediosDiarios();
} 