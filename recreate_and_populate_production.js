#!/usr/bin/env node

/**
 * Script para recrear y poblar la tabla promedios_diarios en producción
 * Ejecuta directamente las consultas SQL sin necesidad de pgAdmin
 * 
 * INSTRUCCIONES:
 * 1. Asegúrate de tener DATABASE_URL configurada (variable de entorno de Render)
 * 2. Ejecutar: node recreate_and_populate_production.js
 */

const fs = require('fs');
const { Pool } = require('pg');

// Configuración de base de datos (local y producción)
let pool;

if (process.env.DATABASE_URL) {
  // Producción (Render)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
  // Local (desarrollo)
  pool = new Pool({
    user: 'sergio',
    host: 'localhost',
    database: 'air_gijon',
    password: 'air',
    port: 5432,
  });
}

console.log('🚀 Iniciando recreación y población de tabla promedios_diarios...');
console.log('DATABASE_URL configurada:', process.env.DATABASE_URL ? 'Sí' : 'No');

async function main() {
  try {
    // Verificar conexión
    console.log('🔗 Verificando conexión...');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conexión exitosa');
    
    // PASO 1: Recrear tabla
    console.log('\n📋 PASO 1: Recreando tabla...');
    const client1 = await pool.connect();
    
    try {
      await client1.query('DROP TABLE IF EXISTS promedios_diarios CASCADE;');
      await client1.query(`
        CREATE TABLE promedios_diarios (
          id SERIAL PRIMARY KEY,
          fecha DATE NOT NULL,
          parametro VARCHAR(20) NOT NULL,
          valor REAL,
          estado TEXT,
          source TEXT DEFAULT 'calculated' NOT NULL,
          detalles TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(fecha, parametro, source)
        );
      `);
      await client1.query('CREATE INDEX idx_promedios_fecha ON promedios_diarios(fecha);');
      console.log('✅ Tabla recreada');
    } finally {
      client1.release();
    }
    
    // PASO 2: Poblar datos
    console.log('\n📋 PASO 2: Poblando datos...');
    const csvContent = fs.readFileSync('constitucion_asturias_air_quality_20250614.csv', 'utf8');
    const lines = csvContent.split('\n').slice(1).filter(line => line.trim());
    
    const client2 = await pool.connect();
    let insertedCount = 0;
    
    try {
      for (const line of lines) {
        const columns = line.split(',').map(col => col.trim());
        if (columns.length < 7) continue;
        
        const dateStr = columns[0];
        if (!dateStr) continue;
        
        // Parsear fecha
        const dateParts = dateStr.split('/');
        const fecha = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
        
        // Validar rango
        const fechaObj = new Date(fecha);
        if (fechaObj < new Date('2025-05-01') || fechaObj > new Date('2025-06-13')) continue;
        
        // Extraer valores
        const valores = [
          { param: 'PM2.5', valor: parseFloat(columns[1]) },
          { param: 'PM10', valor: parseFloat(columns[2]) },
          { param: 'NO2', valor: parseFloat(columns[3]) },
          { param: 'O3', valor: parseFloat(columns[4]) },
          { param: 'SO2', valor: parseFloat(columns[5]) },
          { param: 'CO', valor: parseFloat(columns[6]) }
        ];
        
        // Insertar cada parámetro
        for (const { param, valor } of valores) {
          if (!isNaN(valor) && valor !== null) {
            let estado = 'Sin datos';
            if (param === 'PM2.5') {
              if (valor <= 12) estado = 'Buena';
              else if (valor <= 35) estado = 'Regular';
              else if (valor <= 55) estado = 'Insalubre para grupos sensibles';
              else if (valor <= 150) estado = 'Insalubre';
              else if (valor <= 250) estado = 'Muy Insalubre';
              else estado = 'Peligrosa';
            }
            
            await client2.query(`
              INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (fecha, parametro, source) 
              DO UPDATE SET valor = EXCLUDED.valor, estado = EXCLUDED.estado
            `, [fecha, param, valor, estado, 'csv_historical', 'Datos históricos CSV']);
            
            insertedCount++;
          }
        }
      }
      
      console.log(`✅ Insertados ${insertedCount} registros`);
    } finally {
      client2.release();
    }
    
    // PASO 3: Verificar
    console.log('\n📋 PASO 3: Verificando...');
    const client3 = await pool.connect();
    
    try {
      const result = await client3.query('SELECT COUNT(*) as total FROM promedios_diarios');
      console.log(`📊 Total registros: ${result.rows[0].total}`);
      
      const sample = await client3.query(`
        SELECT fecha, parametro, valor, estado 
        FROM promedios_diarios 
        WHERE parametro = 'PM2.5' 
        ORDER BY fecha DESC 
        LIMIT 3
      `);
      
      console.log('🔍 Últimos registros PM2.5:');
      sample.rows.forEach(row => {
        console.log(`   ${row.fecha.toISOString().split('T')[0]}: ${row.valor} µg/m³ (${row.estado})`);
      });
      
    } finally {
      client3.release();
    }
    
    console.log('\n🎉 ¡Proceso completado exitosamente!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { main }; 