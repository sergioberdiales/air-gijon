const express = require('express');
const path = require('path');
const { pool } = require(path.resolve(__dirname, '../database/db.js'));

const router = express.Router();

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

// Endpoint básico de PM2.5 actual
router.get('/constitucion/pm25', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fecha, valor AS pm25
       FROM mediciones_api
       WHERE estacion_id = '6699' AND parametro = 'pm25'
       ORDER BY fecha DESC
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hay datos disponibles' });
    }
    
    const pm25 = parseFloat(result.rows[0].pm25);
    res.json({
      estacion: "Avenida Constitución",
      fecha: result.rows[0].fecha,
      pm25,
      estado: getEstadoPM25(pm25)
    });
  } catch (error) {
    console.error('Error consultando PM2.5:', error);
    res.status(500).json({ error: 'Error consultando la base de datos' });
  }
});

// Endpoint de evolución simplificado
router.get('/constitucion/evolucion', async (req, res) => {
  try {
    console.log('📊 Solicitando evolución de PM2.5...');
    
    // Calcular las fechas que necesitamos: 5 días históricos + hoy + mañana
    const fechas = [];
    const hoy = new Date();
    
    // 5 días históricos (desde hace 5 días hasta ayer)
    for (let i = 5; i >= 1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      fechas.push({
        fecha: fecha.toISOString().split('T')[0],
        tipo: 'historico'
      });
    }
    
    // Hoy y mañana (predicciones)
    fechas.push({
      fecha: hoy.toISOString().split('T')[0],
      tipo: 'prediccion'
    });
    
    const manana = new Date();
    manana.setDate(hoy.getDate() + 1);
    fechas.push({
      fecha: manana.toISOString().split('T')[0],
      tipo: 'prediccion'
    });
    
    console.log('📅 Fechas solicitadas:', fechas.map(f => `${f.fecha} (${f.tipo})`).join(', '));
    
    // 1. Consultar datos históricos
    const fechasHistoricas = fechas.filter(f => f.tipo === 'historico').map(f => f.fecha);
    const historicos = await pool.query(`
      SELECT DISTINCT ON (fecha) fecha, parametro, valor, estado, source
      FROM promedios_diarios 
      WHERE fecha::text = ANY($1) AND parametro = $2
      ORDER BY fecha ASC, 
        CASE source 
          WHEN 'csv_historical' THEN 1
          WHEN 'csv_historico' THEN 2  
          WHEN 'mediciones_api' THEN 3
          WHEN 'calculated' THEN 4
          ELSE 5
        END
    `, [fechasHistoricas, 'pm25']);
    
    console.log(`📈 Datos históricos PM2.5 encontrados: ${historicos.rows.length} de ${fechasHistoricas.length}`);
    
    // 2. Consultar predicciones usando la misma lógica que send_daily_predictions.js
    const hoyStr = hoy.toISOString().split('T')[0];
    
    const predicciones = await pool.query(`
      SELECT p.fecha, p.valor, p.horizonte_dias, m.nombre_modelo, m.mae
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha >= $1
        AND p.estacion_id = '6699'
        AND p.parametro = 'pm25'
        AND m.activo = true
        AND p.horizonte_dias IN (0, 1)
      ORDER BY p.horizonte_dias ASC
    `, [hoyStr]);
    
    // Mapear predicciones por horizonte (igual que send_daily_predictions.js)
    const predHoy = predicciones.rows.find(row => row.horizonte_dias === 0);
    const predManana = predicciones.rows.find(row => row.horizonte_dias === 1);
    
    console.log(`🔮 Predicciones encontradas: ${predicciones.rows.length}`);
    if (predHoy) console.log(`   - Hoy (horizonte 0): ${predHoy.valor} µg/m³`);
    if (predManana) console.log(`   - Mañana (horizonte 1): ${predManana.valor} µg/m³`);
    
    // 3. Combinar datos
    const datosCompletos = [];
    
    fechas.forEach(fechaInfo => {
      if (fechaInfo.tipo === 'historico') {
        // Buscar dato histórico
        const datos = historicos.rows.find(row => {
          const year = row.fecha.getFullYear();
          const month = String(row.fecha.getMonth() + 1).padStart(2, '0');
          const day = String(row.fecha.getDate()).padStart(2, '0');
          const fechaLocal = `${year}-${month}-${day}`;
          return fechaLocal === fechaInfo.fecha;
        });
        
        if (datos) {
          datosCompletos.push({
            fecha: fechaInfo.fecha,
            promedio_pm10: parseFloat(datos.valor), // Mantener nombre original para compatibilidad
            tipo: 'historico',
            estado: datos.estado
          });
        }
      } else {
        // Predicciones: usar mapeo por horizonte
        if (fechaInfo.fecha === hoyStr && predHoy) {
          datosCompletos.push({
            fecha: fechaInfo.fecha,
            promedio_pm10: Math.round(parseFloat(predHoy.valor)), // Mantener nombre original
            tipo: 'prediccion',
            estado: getEstadoPM25(predHoy.valor)
          });
        } else if (fechaInfo.fecha === manana.toISOString().split('T')[0] && predManana) {
          datosCompletos.push({
            fecha: fechaInfo.fecha,
            promedio_pm10: Math.round(parseFloat(predManana.valor)), // Mantener nombre original
            tipo: 'prediccion',
            estado: getEstadoPM25(predManana.valor)
          });
        }
      }
    });
    
    console.log(`✅ Datos completos generados: ${datosCompletos.length}`);
    
    res.json({
      estacion: "Avenida Constitución",
      datos: datosCompletos,
      total_dias: datosCompletos.length,
      generado_en: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo evolución:', error);
    res.status(500).json({ error: 'Error consultando evolución' });
  }
});

module.exports = router;

