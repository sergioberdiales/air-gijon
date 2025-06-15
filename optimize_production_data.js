const { Pool } = require('pg');

// Configuración para producción (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function optimizeProductionData() {
  try {
    console.log('🔄 Conectando a base de datos de producción...');
    
    // Verificar conexión
    const testQuery = await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa:', testQuery.rows[0].now);
    
    // 1. Verificar datos actuales
    console.log('\n📊 ESTADO ACTUAL DE LA BASE DE DATOS:');
    
    const currentStatsQuery = await pool.query(`
      SELECT 
        parametro,
        COUNT(*) as total,
        MIN(fecha) as primera_fecha,
        MAX(fecha) as ultima_fecha
      FROM promedios_diarios 
      GROUP BY parametro
      ORDER BY parametro
    `);
    
    console.log('Datos actuales por parámetro:');
    currentStatsQuery.rows.forEach(row => {
      console.log(`   ${row.parametro}: ${row.total} registros (${row.primera_fecha} - ${row.ultima_fecha})`);
    });
    
    // 2. Eliminar todos los parámetros que NO sean PM2.5
    console.log('\n🧹 ELIMINANDO PARÁMETROS INNECESARIOS...');
    const deleteOtherParams = await pool.query(`
      DELETE FROM promedios_diarios 
      WHERE parametro != 'pm25'
    `);
    console.log(`🗑️ Eliminados ${deleteOtherParams.rowCount} registros de otros parámetros (pm10, o3, no2, so2, co)`);
    
    // 3. Eliminar datos de PM2.5 anteriores al 1 de mayo de 2025
    console.log('\n🧹 ELIMINANDO DATOS ANTIGUOS DE PM2.5...');
    const deleteOldPM25 = await pool.query(`
      DELETE FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha < '2025-05-01'
    `);
    console.log(`🗑️ Eliminados ${deleteOldPM25.rowCount} registros de PM2.5 anteriores al 1 de mayo de 2025`);
    
    // 4. Verificar datos optimizados
    console.log('\n📊 ESTADO DESPUÉS DE LA OPTIMIZACIÓN:');
    
    const optimizedStatsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_pm25,
        MIN(fecha) as primera_fecha,
        MAX(fecha) as ultima_fecha
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
    `);
    
    const stats = optimizedStatsQuery.rows[0];
    console.log(`✅ PM2.5 optimizado: ${stats.total_pm25} registros desde ${stats.primera_fecha} hasta ${stats.ultima_fecha}`);
    
    // 5. Verificar si hay suficientes datos para predicciones (mínimo 28 días)
    const daysDiff = Math.floor((new Date(stats.ultima_fecha) - new Date(stats.primera_fecha)) / (1000 * 60 * 60 * 24));
    console.log(`📅 Días de cobertura: ${daysDiff} días`);
    
    if (daysDiff >= 28) {
      console.log('✅ Suficientes datos históricos para predicciones (mínimo 28 días)');
    } else {
      console.log('⚠️ Advertencia: Menos de 28 días de cobertura, pueden fallar las predicciones');
    }
    
    // 6. Verificar datos disponibles hasta la fecha del cron job problemático
    const beforeCronQuery = await pool.query(`
      SELECT COUNT(*) as count_before_cron
      FROM promedios_diarios 
      WHERE parametro = 'pm25' 
        AND fecha < '2025-06-15'
    `);
    
    console.log(`🎯 Registros PM2.5 antes del 2025-06-15: ${beforeCronQuery.rows[0].count_before_cron}`);
    
    if (parseInt(beforeCronQuery.rows[0].count_before_cron) >= 28) {
      console.log('✅ Suficientes datos para que funcione el cron job del 15 de junio');
    } else {
      console.log('❌ Insuficientes datos para el cron job del 15 de junio');
    }
    
    // 7. Mostrar algunos datos recientes como verificación
    const sampleQuery = await pool.query(`
      SELECT fecha, valor
      FROM promedios_diarios 
      WHERE parametro = 'pm25'
      ORDER BY fecha DESC
      LIMIT 5
    `);
    
    console.log('\n🔍 Últimos 5 registros PM2.5:');
    sampleQuery.rows.forEach(row => {
      console.log(`   ${row.fecha}: ${row.valor} µg/m³`);
    });
    
    console.log('\n🎉 ¡Base de datos optimizada correctamente!');
    console.log('💡 El cron job de predicciones debería funcionar ahora.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Verificar que estamos en producción
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no encontrada. Este script es solo para producción.');
  process.exit(1);
}

optimizeProductionData(); 