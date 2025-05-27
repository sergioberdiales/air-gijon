const { Pool } = require('pg');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const STATION_ID = '6699';

// Función para generar variación realista basada en patrones típicos
function generateRealisticVariation(baseValue, hour, parameter) {
  let variation = 0;
  
  // Patrones típicos por parámetro
  switch (parameter) {
    case 'pm10':
      // PM10: Mayor en horas punta (7-9, 18-20), menor en madrugada
      if (hour >= 7 && hour <= 9) variation = Math.random() * 15 + 5; // +5 a +20
      else if (hour >= 18 && hour <= 20) variation = Math.random() * 12 + 3; // +3 a +15
      else if (hour >= 0 && hour <= 5) variation = -(Math.random() * 10 + 5); // -5 a -15
      else variation = (Math.random() - 0.5) * 10; // -5 a +5
      break;
      
    case 'no2':
      // NO2: Picos en horas de tráfico
      if (hour >= 7 && hour <= 9) variation = Math.random() * 20 + 10; // +10 a +30
      else if (hour >= 17 && hour <= 19) variation = Math.random() * 18 + 8; // +8 a +26
      else if (hour >= 0 && hour <= 5) variation = -(Math.random() * 15 + 10); // -10 a -25
      else variation = (Math.random() - 0.5) * 8; // -4 a +4
      break;
      
    case 'pm25':
      // PM2.5: Similar a PM10 pero más variable
      if (hour >= 7 && hour <= 9) variation = Math.random() * 12 + 3;
      else if (hour >= 18 && hour <= 20) variation = Math.random() * 10 + 2;
      else if (hour >= 0 && hour <= 5) variation = -(Math.random() * 8 + 3);
      else variation = (Math.random() - 0.5) * 6;
      break;
      
    case 'o3':
      // O3: Mayor durante el día (fotoquímico)
      if (hour >= 12 && hour <= 16) variation = Math.random() * 15 + 5;
      else if (hour >= 0 && hour <= 6) variation = -(Math.random() * 10 + 5);
      else variation = (Math.random() - 0.5) * 8;
      break;
      
    default:
      // Otros parámetros: variación más suave
      variation = (Math.random() - 0.5) * 6;
  }
  
  // Añadir variación aleatoria adicional
  variation += (Math.random() - 0.5) * 4;
  
  // Asegurar que el valor no sea negativo
  const newValue = Math.max(0, baseValue + variation);
  
  return Math.round(newValue * 10) / 10; // Redondear a 1 decimal
}

// Función para generar datos históricos simulados
async function generateHistoricalData() {
  const client = await pool.connect();
  
  try {
    console.log('🎲 Generando datos históricos simulados...');
    
    // Obtener valores base actuales
    const currentData = await client.query(`
      SELECT parametro, valor 
      FROM mediciones_api 
      WHERE estacion_id = $1 
      AND fecha >= NOW() - INTERVAL '1 day'
      ORDER BY fecha DESC
      LIMIT 10
    `, [STATION_ID]);
    
    if (currentData.rows.length === 0) {
      throw new Error('No hay datos actuales para usar como base');
    }
    
    // Crear mapa de valores base
    const baseValues = {};
    currentData.rows.forEach(row => {
      baseValues[row.parametro] = parseFloat(row.valor);
    });
    
    console.log('📊 Valores base obtenidos:', baseValues);
    
    await client.query('BEGIN');
    
    // Generar datos para los últimos 7 días
    for (let day = 7; day >= 1; day--) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      
      console.log(`\n📅 Generando datos para ${date.toDateString()}...`);
      
      // Generar 24 horas de datos
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(date);
        timestamp.setHours(hour, 0, 0, 0);
        
        // Generar datos para cada parámetro
        for (const [parameter, baseValue] of Object.entries(baseValues)) {
          const simulatedValue = generateRealisticVariation(baseValue, hour, parameter);
          
          // Insertar en la base de datos
          await client.query(`
            INSERT INTO mediciones_api (estacion_id, fecha, parametro, valor, aqi, is_validated)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (estacion_id, fecha, parametro) 
            DO UPDATE SET valor = EXCLUDED.valor, aqi = EXCLUDED.aqi
          `, [STATION_ID, timestamp, parameter, simulatedValue, Math.round(simulatedValue), false]);
        }
        
        if (hour % 6 === 0) {
          process.stdout.write(`⏰ ${hour}:00 `);
        }
      }
      
      console.log(`✅ Completado`);
    }
    
    await client.query('COMMIT');
    
    // Estadísticas finales
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_registros,
        COUNT(DISTINCT DATE(fecha)) as dias_generados,
        MIN(fecha) as fecha_inicio,
        MAX(fecha) as fecha_fin
      FROM mediciones_api 
      WHERE estacion_id = $1 
      AND is_validated = false
    `, [STATION_ID]);
    
    console.log('\n📊 ESTADÍSTICAS DE DATOS GENERADOS:');
    console.log(`   Total registros: ${stats.rows[0].total_registros}`);
    console.log(`   Días generados: ${stats.rows[0].dias_generados}`);
    console.log(`   Período: ${stats.rows[0].fecha_inicio} a ${stats.rows[0].fecha_fin}`);
    
    console.log('\n🎉 ¡Datos históricos simulados generados exitosamente!');
    console.log('💡 Nota: Estos datos están marcados como is_validated = false para distinguirlos de los datos reales');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error generando datos:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar el script
generateHistoricalData().catch(console.error); 