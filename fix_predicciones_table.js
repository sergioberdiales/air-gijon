#!/usr/bin/env node

// Script para actualizar la tabla predicciones con columna horizonte_dias
const { pool } = require('./db');

async function fixPrediccionesTable() {
  try {
    console.log('🔧 Actualizando estructura de tabla predicciones...');
    
    // 1. Agregar la columna horizonte_dias si no existe
    console.log('➕ Agregando columna horizonte_dias...');
    await pool.query(`
      ALTER TABLE predicciones 
      ADD COLUMN IF NOT EXISTS horizonte_dias INTEGER DEFAULT 0
    `);
    
    // 2. Actualizar datos existentes para establecer horizonte_dias
    console.log('🔄 Actualizando datos existentes...');
    const updateResult = await pool.query(`
      UPDATE predicciones 
      SET horizonte_dias = 0 
      WHERE horizonte_dias IS NULL
    `);
    console.log(`   Actualizadas ${updateResult.rowCount} filas existentes`);
    
    // 3. Eliminar el constraint único anterior (si existe)
    console.log('🗑️ Eliminando constraint anterior...');
    try {
      await pool.query(`
        ALTER TABLE predicciones 
        DROP CONSTRAINT IF EXISTS predicciones_fecha_estacion_id_modelo_id_parametro_key
      `);
    } catch (error) {
      console.log('   (Constraint anterior no existía o ya fue eliminado)');
    }
    
    // 4. Crear el nuevo constraint único que incluye horizonte_dias
    console.log('🔐 Creando nuevo constraint único...');
    try {
      await pool.query(`
        ALTER TABLE predicciones 
        ADD CONSTRAINT predicciones_fecha_estacion_modelo_parametro_horizonte_unique 
        UNIQUE (fecha, estacion_id, modelo_id, parametro, horizonte_dias)
      `);
    } catch (error) {
      if (error.code === '23505' || error.message.includes('already exists')) {
        console.log('   (Constraint único ya existe)');
      } else {
        throw error;
      }
    }
    
    // 5. Crear índice para mejorar rendimiento con horizonte_dias
    console.log('📊 Creando índice adicional...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_predicciones_horizonte_fecha 
      ON predicciones(horizonte_dias, fecha)
    `);
    
    // 6. Verificar la estructura final
    console.log('🔍 Verificando estructura actualizada...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'predicciones' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Estructura actual de tabla predicciones:');
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // 7. Verificar constraints
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'predicciones'
    `);
    
    console.log('\n🔐 Constraints activos:');
    constraints.rows.forEach(c => {
      console.log(`   ${c.constraint_name}: ${c.constraint_type}`);
    });
    
    console.log('\n✅ Tabla predicciones actualizada exitosamente');
    
  } catch (error) {
    console.error('❌ Error actualizando tabla predicciones:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  console.log('🔗 Conectando a la base de datos...');
  fixPrediccionesTable()
    .then(() => {
      console.log('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { fixPrediccionesTable }; 