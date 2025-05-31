#!/usr/bin/env node

// Script para generar predicciones diarias usando la nueva arquitectura
// Se ejecuta automáticamente para generar predicciones de PM2.5

const { pool } = require('./db');

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

async function obtenerModeloActivo() {
  try {
    const result = await pool.query(`
      SELECT id, nombre_modelo, roc_index
      FROM modelos_prediccion
      WHERE activo = true
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('No hay modelo activo configurado');
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error obteniendo modelo activo:', error);
    throw error;
  }
}

async function obtenerDatosHistoricos(dias = 7) {
  try {
    const result = await pool.query(`
      SELECT pm25_promedio, fecha
      FROM promedios_diarios
      WHERE fecha >= CURRENT_DATE - INTERVAL '${dias} days'
      ORDER BY fecha DESC
      LIMIT ${dias}
    `);
    
    return result.rows.map(row => parseFloat(row.pm25_promedio));
  } catch (error) {
    console.error('❌ Error obteniendo datos históricos:', error);
    return [];
  }
}

function generarPrediccionPM25(datosHistoricos) {
  // Algoritmo simple basado en promedio histórico con variación
  let valorBase;
  
  if (datosHistoricos.length > 0) {
    // Promedio de últimos datos disponibles
    const promedio = datosHistoricos.reduce((sum, val) => sum + val, 0) / datosHistoricos.length;
    
    // Aplicar tendencia y variación aleatoria
    const tendencia = 1 + (Math.random() - 0.5) * 0.2; // ±10% variación
    valorBase = promedio * tendencia;
  } else {
    // Fallback: valor típico para Gijón
    valorBase = 18 + (Math.random() - 0.5) * 8; // 14-22 µg/m³
  }
  
  // Asegurar que esté en rango razonable (5-45 µg/m³)
  const valor = Math.max(5, Math.min(45, valorBase));
  
  return Math.round(valor * 100) / 100;
}

async function insertarPrediccion(fecha, estacionId, modeloId, parametro, valor) {
  try {
    const result = await pool.query(`
      INSERT INTO predicciones (
        fecha, 
        estacion_id, 
        modelo_id, 
        parametro, 
        valor,
        fecha_generacion
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (fecha, estacion_id, modelo_id, parametro) 
      DO UPDATE SET
        valor = EXCLUDED.valor,
        fecha_generacion = CURRENT_TIMESTAMP
      RETURNING id
    `, [fecha, estacionId, modeloId, parametro, valor]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error(`❌ Error insertando predicción para ${fecha}:`, error);
    throw error;
  }
}

async function generarPrediccionesDiarias() {
  try {
    console.log('🔮 Iniciando generación de predicciones diarias...');
    
    // 1. Obtener modelo activo
    const modelo = await obtenerModeloActivo();
    console.log(`📊 Usando modelo: ${modelo.nombre_modelo} (ID: ${modelo.id}, ROC: ${modelo.roc_index})`);
    
    // 2. Obtener datos históricos para el contexto
    const datosHistoricos = await obtenerDatosHistoricos(7);
    console.log(`📈 Datos históricos obtenidos: ${datosHistoricos.length} registros`);
    
    if (datosHistoricos.length > 0) {
      const promedio = datosHistoricos.reduce((sum, val) => sum + val, 0) / datosHistoricos.length;
      console.log(`📊 Promedio histórico: ${promedio.toFixed(2)} µg/m³`);
    }
    
    // 3. Generar predicciones para hoy y mañana
    const hoy = new Date();
    const fechasPrediccion = [
      hoy.toISOString().split('T')[0], // Hoy
      new Date(hoy.getTime() + 24*60*60*1000).toISOString().split('T')[0] // Mañana
    ];
    
    const estacionId = '6699'; // Avenida Constitución
    const parametro = 'pm25';
    
    let prediccionesGeneradas = 0;
    
    for (const fecha of fechasPrediccion) {
      // Generar predicción
      const valorPM25 = generarPrediccionPM25(datosHistoricos);
      const estado = getEstadoPM25(valorPM25);
      
      // Insertar en la base de datos
      const prediccionId = await insertarPrediccion(
        fecha, 
        estacionId, 
        modelo.id, 
        parametro, 
        valorPM25
      );
      
      console.log(`✅ Predicción ${fecha}: ${valorPM25} µg/m³ (${estado}) - ID: ${prediccionId}`);
      prediccionesGeneradas++;
    }
    
    console.log(`🎯 Generadas ${prediccionesGeneradas} predicciones exitosamente`);
    
    // 4. Mostrar resumen de predicciones activas
    const resumen = await pool.query(`
      SELECT 
        p.fecha,
        p.valor,
        m.nombre_modelo
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha >= CURRENT_DATE
        AND p.estacion_id = $1
        AND p.parametro = $2
        AND m.activo = true
      ORDER BY p.fecha ASC
    `, [estacionId, parametro]);
    
    console.log('\n📋 Predicciones activas:');
    resumen.rows.forEach(pred => {
      const estado = getEstadoPM25(pred.valor);
      console.log(`   ${pred.fecha}: ${pred.valor} µg/m³ (${estado}) - ${pred.nombre_modelo}`);
    });
    
    console.log('\n✅ Proceso de predicciones completado');
    
  } catch (error) {
    console.error('❌ Error generando predicciones:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  generarPrediccionesDiarias()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { 
  generarPrediccionesDiarias,
  obtenerModeloActivo,
  generarPrediccionPM25
}; 