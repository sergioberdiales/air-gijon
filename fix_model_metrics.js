#!/usr/bin/env node

// Script para actualizar métricas de modelos: ROC → MAE (métrica correcta para regresión)
const { pool } = require('./db');

async function fixModelMetrics() {
  try {
    console.log('📊 Actualizando métricas de modelos: ROC → MAE...');
    
    // 1. Agregar columna MAE a la tabla
    console.log('➕ Agregando columna mae...');
    await pool.query(`
      ALTER TABLE modelos_prediccion 
      ADD COLUMN IF NOT EXISTS mae DECIMAL(6,3)
    `);
    
    // 2. Actualizar el Modelo_1.0 con MAE correcto
    console.log('🔄 Actualizando Modelo_1.0 con MAE correcto...');
    await pool.query(`
      UPDATE modelos_prediccion 
      SET mae = 8.37,
          roc_index = NULL,
          descripcion = 'Modelo LightGBM entrenado con 33 variables (16 lags, 13 diferencias, 2 tendencias, 2 exógenas). MAE: 8.37 µg/m³. Datos de entrenamiento: mayo 2024 - abril 2025.',
          updated_at = CURRENT_TIMESTAMP
      WHERE nombre_modelo = 'Modelo_1.0'
    `);
    
    // 3. Actualizar el Modelo_0.0 con métricas apropiadas
    console.log('🔄 Actualizando Modelo_0.0...');
    await pool.query(`
      UPDATE modelos_prediccion 
      SET mae = 15.50,
          roc_index = NULL,
          descripcion = 'Modelo inicial basado en datos históricos con variación aleatoria. Algoritmo simple de promedio móvil. MAE estimado: ~15.5 µg/m³.',
          updated_at = CURRENT_TIMESTAMP
      WHERE nombre_modelo = 'Modelo_0.0'
    `);
    
    // 4. Mostrar estructura actualizada
    console.log('\n📋 Estructura actualizada de tabla modelos_prediccion:');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'modelos_prediccion' 
      ORDER BY ordinal_position
    `);
    
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // 5. Mostrar modelos actualizados
    console.log('\n🤖 Modelos actualizados:');
    const modelos = await pool.query(`
      SELECT 
        id,
        nombre_modelo,
        fecha_inicio_produccion,
        fecha_fin_produccion,
        mae,
        roc_index,
        activo,
        LEFT(descripcion, 100) as descripcion_corta
      FROM modelos_prediccion
      ORDER BY id
    `);
    
    modelos.rows.forEach(modelo => {
      const estado = modelo.activo ? '🟢 ACTIVO' : '🔴 Inactivo';
      const periodo = modelo.fecha_fin_produccion ? 
        `${modelo.fecha_inicio_produccion} → ${modelo.fecha_fin_produccion}` : 
        `${modelo.fecha_inicio_produccion} → Actual`;
      
      console.log(`   ${estado} ${modelo.nombre_modelo} (ID: ${modelo.id})`);
      console.log(`     MAE: ${modelo.mae ? modelo.mae + ' µg/m³' : 'N/A'} | ROC: ${modelo.roc_index || 'N/A (no aplicable)'}`);
      console.log(`     Período: ${periodo}`);
      console.log(`     Descripción: ${modelo.descripcion_corta}...`);
      console.log('');
    });
    
    // 6. Verificar modelo activo
    const modeloActivo = await pool.query(`
      SELECT nombre_modelo, mae, roc_index
      FROM modelos_prediccion
      WHERE activo = true
    `);
    
    if (modeloActivo.rows.length === 1) {
      const modelo = modeloActivo.rows[0];
      console.log(`🎯 Modelo activo: ${modelo.nombre_modelo}`);
      console.log(`   MAE: ${modelo.mae} µg/m³ (métrica correcta para regresión)`);
      console.log(`   ROC: ${modelo.roc_index || 'N/A (no aplicable para regresión)'}`);
    }
    
    console.log('\n✅ Métricas de modelos actualizadas correctamente');
    console.log('📝 Nota: ROC se mantiene en la tabla por compatibilidad, pero MAE es la métrica principal');
    
  } catch (error) {
    console.error('❌ Error actualizando métricas:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  console.log('🔗 Conectando a la base de datos...');
  fixModelMetrics()
    .then(() => {
      console.log('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { fixModelMetrics }; 