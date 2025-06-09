#!/usr/bin/env node

// Script para registrar el modelo LightGBM real como Modelo_1.0
const { pool } = require('./db');

async function createLightGBMModel() {
  try {
    console.log('🤖 Registrando modelo LightGBM real como Modelo_1.0...');
    
    // 1. Desactivar todos los modelos existentes
    console.log('🔄 Desactivando modelos anteriores...');
    await pool.query(`
      UPDATE modelos_prediccion 
      SET activo = false, 
          fecha_fin_produccion = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
    `);
    
    // 2. Crear el nuevo modelo LightGBM
    console.log('✨ Creando Modelo_1.0 (LightGBM)...');
    const result = await pool.query(`
      INSERT INTO modelos_prediccion (
        nombre_modelo,
        fecha_inicio_produccion,
        roc_index,
        descripcion,
        activo
      ) VALUES (
        'Modelo_1.0',
        CURRENT_DATE,
        0.8370,
        'Modelo LightGBM entrenado con 33 variables (16 lags, 13 diferencias, 2 tendencias, 2 exógenas). MAE: 8.37 µg/m³. Datos de entrenamiento: mayo 2024 - abril 2025.',
        true
      )
      ON CONFLICT (nombre_modelo) DO UPDATE SET
        activo = true,
        fecha_inicio_produccion = CURRENT_DATE,
        fecha_fin_produccion = NULL,
        roc_index = EXCLUDED.roc_index,
        descripcion = EXCLUDED.descripcion,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);
    
    const modeloNuevo = result.rows[0];
    console.log(`✅ Modelo_1.0 creado/actualizado con ID: ${modeloNuevo.id}`);
    
    // 3. Mostrar resumen de modelos
    console.log('\n📊 Estado actual de modelos:');
    const modelos = await pool.query(`
      SELECT 
        id,
        nombre_modelo,
        fecha_inicio_produccion,
        fecha_fin_produccion,
        roc_index,
        activo,
        LEFT(descripcion, 80) as descripcion_corta
      FROM modelos_prediccion
      ORDER BY id
    `);
    
    modelos.rows.forEach(modelo => {
      const estado = modelo.activo ? '🟢 ACTIVO' : '🔴 Inactivo';
      const periodo = modelo.fecha_fin_produccion ? 
        `${modelo.fecha_inicio_produccion} → ${modelo.fecha_fin_produccion}` : 
        `${modelo.fecha_inicio_produccion} → Actual`;
      
      console.log(`   ${estado} ${modelo.nombre_modelo} (ID: ${modelo.id})`);
      console.log(`     ROC: ${modelo.roc_index} | Período: ${periodo}`);
      console.log(`     Descripción: ${modelo.descripcion_corta}...`);
      console.log('');
    });
    
    // 4. Verificar que el modelo activo es el correcto
    const modeloActivo = await pool.query(`
      SELECT nombre_modelo, roc_index, descripcion
      FROM modelos_prediccion
      WHERE activo = true
    `);
    
    if (modeloActivo.rows.length === 1) {
      console.log(`🎯 Modelo activo confirmado: ${modeloActivo.rows[0].nombre_modelo}`);
      console.log(`   ROC Index: ${modeloActivo.rows[0].roc_index}`);
    } else {
      console.warn('⚠️ Problema: No hay exactamente un modelo activo');
    }
    
    console.log('\n✅ Modelo LightGBM registrado exitosamente');
    
  } catch (error) {
    console.error('❌ Error registrando modelo LightGBM:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  console.log('🔗 Conectando a la base de datos...');
  createLightGBMModel()
    .then(() => {
      console.log('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { createLightGBMModel }; 