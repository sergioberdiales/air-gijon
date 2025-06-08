require('dotenv').config({ path: './.env_local' });
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

/**
 * Script para cargar datos históricos de PM2.5 desde CSV a la tabla promedios_diarios
 * Carga datos desde el 1 de mayo de 2025 hasta donde haya datos disponibles
 */

const CSV_PATH = path.join(__dirname, 'modelos_prediccion', 'constitucion_asturias_air_quality.csv');
const START_DATE = '2025-05-01';

async function loadHistoricalData() {
  try {
    console.log('🔄 Iniciando carga de datos históricos...');
    
    // Leer el archivo CSV
    const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = csvContent.split('\n');
    
    // Procesar datos
    const records = [];
    let validCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) { // Saltar header
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',').map(col => col.trim());
      if (columns.length < 2) continue;
      
      const dateStr = columns[0];
      const pm25Str = columns[1];
      
      // Parsear fecha (formato: 2025/5/1)
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) continue;
      
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const day = parseInt(dateParts[2]);
      
      const date = new Date(year, month - 1, day); // month - 1 porque Date usa 0-based months
      const dateISO = date.toISOString().split('T')[0];
      
      // Filtrar por fecha de inicio
      if (dateISO < START_DATE) {
        skippedCount++;
        continue;
      }
      
      // Parsear PM2.5
      const pm25Value = parseFloat(pm25Str);
      if (isNaN(pm25Value)) {
        console.log(`⚠️ Valor PM2.5 inválido en fecha ${dateISO}: ${pm25Str}`);
        skippedCount++;
        continue;
      }
      
      records.push({
        fecha: dateISO,
        pm25: pm25Value
      });
      validCount++;
    }
    
    console.log(`📊 Datos procesados:`);
    console.log(`   - Registros válidos: ${validCount}`);
    console.log(`   - Registros saltados: ${skippedCount}`);
    console.log(`   - Rango de fechas: ${records[records.length - 1]?.fecha} a ${records[0]?.fecha}`);
    
    if (records.length === 0) {
      console.log('❌ No se encontraron datos válidos para cargar');
      return;
    }
    
    // Ordenar por fecha (más antiguo primero)
    records.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    // Insertar en la base de datos
    console.log('🔄 Insertando datos en promedios_diarios...');
    
    let insertedCount = 0;
    let duplicateCount = 0;
    
    for (const record of records) {
      try {
        // Verificar si ya existe
        const existing = await pool.query(
          'SELECT id FROM promedios_diarios WHERE fecha = $1 AND parametro = $2',
          [record.fecha, 'pm25']
        );
        
        if (existing.rows.length > 0) {
          duplicateCount++;
          continue;
        }
        
        // Insertar nuevo registro
        await pool.query(`
          INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          record.fecha,
          'pm25',
          record.pm25,
          getEstadoPM25(record.pm25),
          'csv_historico'
        ]);
        
        insertedCount++;
        
        if (insertedCount % 10 === 0) {
          console.log(`   Insertados: ${insertedCount}/${records.length}`);
        }
        
      } catch (error) {
        console.error(`❌ Error insertando ${record.fecha}:`, error.message);
      }
    }
    
    console.log('✅ Carga completada:');
    console.log(`   - Registros insertados: ${insertedCount}`);
    console.log(`   - Duplicados saltados: ${duplicateCount}`);
    
    // Mostrar algunos registros como verificación
    const sample = await pool.query(`
      SELECT fecha, valor, estado 
      FROM promedios_diarios 
      WHERE parametro = 'pm25' AND source = 'csv_historico'
      ORDER BY fecha DESC 
      LIMIT 5
    `);
    
    console.log('\n📋 Últimos 5 registros insertados:');
    sample.rows.forEach(row => {
      console.log(`   ${row.fecha}: ${row.valor} µg/m³ (${row.estado})`);
    });
    
  } catch (error) {
    console.error('❌ Error en la carga de datos:', error);
  } finally {
    await pool.end();
  }
}

// Función para calcular el estado según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  loadHistoricalData();
}

module.exports = { loadHistoricalData }; 