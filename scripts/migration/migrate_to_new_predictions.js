#!/usr/bin/env node

// Script de migración para la nueva arquitectura de predicciones
// Migra datos existentes y configura el modelo inicial

const { pool } = require('../../src/database/db');

async function migrate() {
  try {
    console.log('🔄 Iniciando migración a nueva arquitectura de predicciones...');
    
    // 1. Crear el modelo inicial si no existe
    console.log('📝 Creando modelo inicial...');
    const modeloResult = await pool.query(`
      INSERT INTO modelos_prediccion (
        nombre_modelo, 
        fecha_inicio_produccion, 
        descripcion, 
        activo,
        roc_index
      ) VALUES (
        'Modelo_0.0',
        CURRENT_DATE,
        'Modelo inicial basado en datos históricos con variación aleatoria',
        true,
        0.6500
      )
      ON CONFLICT (nombre_modelo) DO UPDATE SET
        activo = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `);
    
    const modeloId = modeloResult.rows[0].id;
    console.log(`✅ Modelo 'Modelo_0.0' configurado con ID: ${modeloId}`);
    
    // 2. Migrar predicciones existentes de promedios_diarios
    console.log('🔄 Migrando predicciones existentes...');
    
    const prediccionesExistentes = await pool.query(`
      SELECT fecha, pm25_promedio, confianza
      FROM promedios_diarios 
      WHERE tipo = 'prediccion'
      ORDER BY fecha
    `);
    
    console.log(`📊 Encontradas ${prediccionesExistentes.rows.length} predicciones para migrar`);
    
    let migradas = 0;
    for (const pred of prediccionesExistentes.rows) {
      try {
        await pool.query(`
          INSERT INTO predicciones (
            fecha, 
            estacion_id, 
            modelo_id, 
            parametro, 
            valor,
            fecha_generacion
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (fecha, estacion_id, modelo_id, parametro) DO NOTHING
        `, [
          pred.fecha,
          '6699', // ID de estación Constitución
          modeloId,
          'pm25',
          pred.pm25_promedio,
          pred.fecha || new Date()
        ]);
        migradas++;
      } catch (error) {
        console.warn(`⚠️ Error migrando predicción ${pred.fecha}:`, error.message);
      }
    }
    
    console.log(`✅ Migradas ${migradas} predicciones a nueva tabla`);
    
    // 3. Limpiar promedios_diarios de predicciones
    console.log('🧹 Limpiando tabla promedios_diarios...');
    
    const eliminadas = await pool.query(`
      DELETE FROM promedios_diarios 
      WHERE tipo = 'prediccion'
    `);
    
    console.log(`✅ Eliminadas ${eliminadas.rowCount} predicciones de promedios_diarios`);
    
    // 4. Eliminar columnas innecesarias de promedios_diarios
    console.log('🔧 Actualizando estructura de promedios_diarios...');
    
    try {
      await pool.query(`ALTER TABLE promedios_diarios DROP COLUMN IF EXISTS tipo`);
      await pool.query(`ALTER TABLE promedios_diarios DROP COLUMN IF EXISTS confianza`);
      console.log('✅ Columnas tipo y confianza eliminadas de promedios_diarios');
    } catch (error) {
      console.log('⚠️ Columnas ya eliminadas o no existen');
    }
    
    // 5. Mostrar resumen final
    console.log('\n📋 Resumen de migración:');
    
    const resumenModelos = await pool.query(`
      SELECT nombre_modelo, fecha_inicio_produccion, activo, roc_index
      FROM modelos_prediccion
      ORDER BY id
    `);
    
    console.log('\n🔮 Modelos configurados:');
    resumenModelos.rows.forEach(modelo => {
      console.log(`   ${modelo.nombre_modelo} (activo: ${modelo.activo}, ROC: ${modelo.roc_index})`);
    });
    
    const resumenPredicciones = await pool.query(`
      SELECT 
        parametro,
        COUNT(*) as total,
        MIN(fecha) as desde,
        MAX(fecha) as hasta
      FROM predicciones
      GROUP BY parametro
      ORDER BY parametro
    `);
    
    console.log('\n📊 Predicciones almacenadas:');
    resumenPredicciones.rows.forEach(param => {
      console.log(`   ${param.parametro}: ${param.total} registros (${param.desde} a ${param.hasta})`);
    });
    
    const resumenPromedios = await pool.query(`
      SELECT COUNT(*) as total_historicos
      FROM promedios_diarios
    `);
    
    console.log(`\n📈 Datos históricos: ${resumenPromedios.rows[0].total_historicos} registros`);
    
    console.log('\n✅ Migración completada exitosamente');
    console.log('🎯 El sistema está listo para usar la nueva arquitectura');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrate();
}

module.exports = { migrate }; 