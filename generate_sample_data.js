#!/usr/bin/env node

// Script para generar datos de muestra usando la nueva arquitectura
// Crea modelo inicial y genera datos históricos y predicciones

const { pool } = require('./db');

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

async function crearModeloInicial() {
  try {
    console.log('🤖 Creando modelo inicial...');
    
    const result = await pool.query(`
      INSERT INTO modelos_prediccion (
        nombre_modelo, 
        fecha_inicio_produccion, 
        descripcion, 
        activo,
        roc_index
      ) VALUES (
        'Modelo_0.0',
        CURRENT_DATE,
        'Modelo inicial basado en datos históricos con variación aleatoria. Algoritmo simple de promedio móvil.',
        true,
        0.6500
      )
      ON CONFLICT (nombre_modelo) DO UPDATE SET
        activo = true,
        descripcion = EXCLUDED.descripcion,
        roc_index = EXCLUDED.roc_index,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, nombre_modelo
    `);
    
    console.log(`✅ Modelo ${result.rows[0].nombre_modelo} creado/actualizado con ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Error creando modelo:', error);
    throw error;
  }
}

async function generateSampleData() {
  try {
    console.log('🔄 Generando datos de muestra para nueva arquitectura...');
    
    // 1. Crear modelo inicial
    const modeloId = await crearModeloInicial();
    
    const hoy = new Date();
    const estacionId = '6699'; // Avenida Constitución
    
    // 2. Generar datos históricos en promedios_diarios
    console.log('📈 Generando datos históricos...');
    
    const datosHistoricos = [];
    for (let i = 15; i >= 1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Valores realistas de PM2.5 para históricos
      const valor = Math.round((12 + Math.random() * 8) * 100) / 100; // 12-20 µg/m³
      const estado = getEstadoPM25(valor);
      
      datosHistoricos.push({
        fecha: fechaStr,
        pm25_promedio: valor,
        estado: estado
      });
    }
    
    console.log(`📊 Insertando ${datosHistoricos.length} registros históricos...`);
    
    for (const dato of datosHistoricos) {
      await pool.query(`
        INSERT INTO promedios_diarios (fecha, pm25_promedio, pm25_estado, source)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (fecha) DO UPDATE SET
          pm25_promedio = EXCLUDED.pm25_promedio,
          pm25_estado = EXCLUDED.pm25_estado,
          source = EXCLUDED.source,
          updated_at = CURRENT_TIMESTAMP
      `, [
        dato.fecha,
        dato.pm25_promedio,
        dato.estado,
        'sample_generator'
      ]);
    }
    
    // 3. Generar predicciones en tabla predicciones
    console.log('🔮 Generando predicciones...');
    
    const predicciones = [];
    for (let i = 0; i <= 1; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Valores realistas para predicciones
      const valor = Math.round((15 + Math.random() * 10) * 100) / 100; // 15-25 µg/m³
      const estado = getEstadoPM25(valor);
      
      predicciones.push({
        fecha: fechaStr,
        valor: valor,
        estado: estado
      });
    }
    
    console.log(`🎯 Insertando ${predicciones.length} predicciones...`);
    
    for (const pred of predicciones) {
      await pool.query(`
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
      `, [
        pred.fecha,
        estacionId,
        modeloId,
        'pm25',
        pred.valor
      ]);
    }
    
    console.log('✅ Datos de muestra generados exitosamente');
    
    // 4. Mostrar resumen
    console.log('\n📋 Resumen de datos generados:');
    
    // Resumen históricos
    const resumenHistoricos = await pool.query(`
      SELECT COUNT(*) as cantidad, MIN(fecha) as desde, MAX(fecha) as hasta
      FROM promedios_diarios
      WHERE source = 'sample_generator'
    `);
    
    console.log(`📈 Datos históricos: ${resumenHistoricos.rows[0].cantidad} registros (${resumenHistoricos.rows[0].desde} a ${resumenHistoricos.rows[0].hasta})`);
    
    // Resumen predicciones
    const resumenPredicciones = await pool.query(`
      SELECT 
        p.parametro,
        COUNT(*) as cantidad, 
        MIN(p.fecha) as desde, 
        MAX(p.fecha) as hasta,
        m.nombre_modelo
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE m.activo = true
      GROUP BY p.parametro, m.nombre_modelo
    `);
    
    console.log('\n🔮 Predicciones:');
    resumenPredicciones.rows.forEach(row => {
      console.log(`   ${row.parametro}: ${row.cantidad} registros (${row.desde} a ${row.hasta}) - ${row.nombre_modelo}`);
    });
    
    // Mostrar datos recientes
    const recientes = await pool.query(`
      SELECT 
        'historico' as tipo,
        fecha, 
        pm25_promedio as valor, 
        pm25_estado as estado,
        'N/A' as modelo
      FROM promedios_diarios
      WHERE fecha >= CURRENT_DATE - INTERVAL '3 days'
      
      UNION ALL
      
      SELECT 
        'prediccion' as tipo,
        p.fecha, 
        p.valor, 
        'calculado' as estado,
        m.nombre_modelo as modelo
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha >= CURRENT_DATE
        AND p.parametro = 'pm25'
        AND m.activo = true
      
      ORDER BY fecha DESC
      LIMIT 10
    `);
    
    console.log('\n📅 Últimos registros:');
    recientes.rows.forEach(row => {
      const valor = parseFloat(row.valor);
      const estado = row.tipo === 'historico' ? row.estado : getEstadoPM25(valor);
      console.log(`   ${row.fecha}: ${valor} µg/m³ (${estado}) - ${row.tipo} ${row.modelo !== 'N/A' ? `[${row.modelo}]` : ''}`);
    });
    
    console.log('\n🎯 Listo para probar el endpoint /api/air/constitucion/evolucion');
    console.log('🎯 También listo para ejecutar: npm run cron-predictions');
    
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

module.exports = { generateSampleData, crearModeloInicial }; 