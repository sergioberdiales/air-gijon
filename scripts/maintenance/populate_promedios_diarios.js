#!/usr/bin/env node

// Cargar variables de entorno
require('dotenv').config({ path: require('path').resolve(process.cwd(), 'config/.env_local') });

const { pool } = require('../../src/database/db');

/**
 * Script para poblar promedios_diarios desde mediciones_api
 * Necesario para que el sistema de predicciones Python tenga suficientes datos
 */

function getEstadoPM25(valor) {
  if (valor <= 12) return 'Buena';
  if (valor <= 35) return 'Regular';
  if (valor <= 55) return 'Insalubre para grupos sensibles';
  if (valor <= 150) return 'Insalubre';
  if (valor <= 250) return 'Muy Insalubre';
  return 'Peligrosa';
}

async function calcularPromediosHistoricos() {
  try {
    console.log('📊 Calculando promedios diarios históricos desde mediciones_api...');
    
    // Verificar cuántas mediciones hay disponibles
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_mediciones,
        COUNT(DISTINCT DATE(fecha)) as dias_disponibles,
        MIN(DATE(fecha)) as fecha_inicio,
        MAX(DATE(fecha)) as fecha_fin
      FROM mediciones_api 
      WHERE estacion_id = '6699' 
        AND parametro = 'pm25' 
        AND valor IS NOT NULL
    `);
    
    const stats = statsResult.rows[0];
    console.log(`📈 Estadísticas de mediciones_api:`);
    console.log(`   - Total mediciones: ${stats.total_mediciones}`);
    console.log(`   - Días disponibles: ${stats.dias_disponibles}`);
    console.log(`   - Período: ${stats.fecha_inicio} a ${stats.fecha_fin}`);
    
    if (parseInt(stats.total_mediciones) === 0) {
      console.error('❌ No hay mediciones de PM2.5 en mediciones_api');
      return 0;
    }
    
    // Calcular e insertar promedios diarios
    const result = await pool.query(`
      INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
      SELECT 
        DATE(fecha) as fecha,
        'pm25' as parametro,
        ROUND(AVG(valor), 2) as valor,
        '' as estado,  -- Se actualiza después
        'mediciones_api' as source,
        jsonb_build_object(
          'min_valor', MIN(valor),
          'max_valor', MAX(valor),
          'desviacion', ROUND(STDDEV(valor), 2),
          'datos_utilizados', COUNT(*),
          'fecha_calculo', CURRENT_TIMESTAMP
        ) as detalles
      FROM mediciones_api 
      WHERE estacion_id = '6699' 
        AND parametro = 'pm25' 
        AND valor IS NOT NULL
      GROUP BY DATE(fecha)
      ON CONFLICT (fecha, parametro, source) 
      DO UPDATE SET 
        valor = EXCLUDED.valor,
        detalles = EXCLUDED.detalles,
        updated_at = CURRENT_TIMESTAMP
      RETURNING fecha, valor
    `);
    
    console.log(`✅ Promedios históricos procesados: ${result.rowCount} días`);
    
    // Actualizar estados PM2.5
    console.log('🔄 Actualizando estados PM2.5...');
    
    for (const row of result.rows) {
      const estado = getEstadoPM25(parseFloat(row.valor));
      await pool.query(`
        UPDATE promedios_diarios 
        SET estado = $1 
        WHERE fecha = $2 AND parametro = 'pm25' AND source = 'mediciones_api'
      `, [estado, row.fecha]);
    }
    
    console.log('✅ Estados PM2.5 actualizados');
    
    // Mostrar resumen de los últimos datos
    const resumenResult = await pool.query(`
      SELECT fecha, valor, estado, detalles->'datos_utilizados' as datos_utilizados
      FROM promedios_diarios 
      WHERE parametro = 'pm25' AND source = 'mediciones_api'
      ORDER BY fecha DESC 
      LIMIT 10
    `);
    
    console.log('\n📋 Últimos 10 promedios calculados:');
    resumenResult.rows.forEach(row => {
      const fecha = row.fecha.toISOString().split('T')[0];
      console.log(`   ${fecha}: ${row.valor} µg/m³ (${row.estado}) - ${row.datos_utilizados} mediciones`);
    });
    
    return result.rowCount;
    
  } catch (error) {
    console.error('❌ Error calculando promedios históricos:', error);
    throw error;
  }
}

async function verificarDatosSuficientes() {
  try {
    console.log('\n🔍 Verificando si hay suficientes datos para predicciones...');
    
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_dias
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      ORDER BY fecha DESC
    `);
    
    const totalDias = parseInt(countResult.rows[0].total_dias);
    const minRequeridos = 35; // Mínimo requerido por Python
    
    console.log(`📊 Días disponibles en promedios_diarios: ${totalDias}`);
    console.log(`📊 Días mínimos requeridos: ${minRequeridos}`);
    
    if (totalDias >= minRequeridos) {
      console.log('✅ Suficientes datos para predicciones Python');
      return true;
    } else {
      console.log(`❌ Insuficientes datos (faltan ${minRequeridos - totalDias} días)`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error verificando datos:', error);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 INICIANDO POBLACIÓN DE PROMEDIOS_DIARIOS');
    console.log('=' * 50);
    
    // 1. Calcular promedios históricos
    const diasProcesados = await calcularPromediosHistoricos();
    
    // 2. Verificar si hay suficientes datos
    const suficientes = await verificarDatosSuficientes();
    
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   - Días procesados: ${diasProcesados}`);
    console.log(`   - Datos suficientes para predicciones: ${suficientes ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (suficientes) {
      console.log('\n💡 SIGUIENTE PASO:');
      console.log('   Las predicciones Python ahora deberían funcionar.');
      console.log('   Ejecuta el cron de predicciones para probar.');
    } else {
      console.log('\n💡 SIGUIENTE PASO:');
      console.log('   Necesitas más datos históricos.');
      console.log('   Considera cargar datos desde CSV o API externa.');
    }
    
  } catch (error) {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { calcularPromediosHistoricos, verificarDatosSuficientes }; 