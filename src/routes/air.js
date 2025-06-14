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

// Endpoint de evolución actualizado para nueva arquitectura (sin Math.random)
router.get('/constitucion/evolucion', async (req, res) => {
  try {
    console.log('📊 Solicitando evolución de PM2.5 (nueva arquitectura)...');
    
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
    
    // 1. Consultar datos históricos (priorizar csv_historical)
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
    
    // 2. Consultar predicciones con el modelo activo
    const fechasPredicciones = fechas.filter(f => f.tipo === 'prediccion').map(f => f.fecha);
    const predicciones = await pool.query(`
      SELECT p.fecha, p.valor, m.nombre_modelo, m.mae, m.roc_index
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha::text = ANY($1) 
        AND p.estacion_id = '6699'
        AND p.parametro = 'pm25'
        AND m.activo = true
      ORDER BY p.fecha ASC
    `, [fechasPredicciones]);
    
    console.log(`🔮 Predicciones encontradas: ${predicciones.rows.length} de ${fechasPredicciones.length}`);
    
    // 3. Combinar y completar datos faltantes
    const datosCompletos = [];
    let ultimoValorHistorico = null;
    
    fechas.forEach(fechaInfo => {
      let datos = null;
      
      if (fechaInfo.tipo === 'historico') {
        datos = historicos.rows.find(row => {
          // Fix timezone: use local date components instead of ISO
          const year = row.fecha.getFullYear();
          const month = String(row.fecha.getMonth() + 1).padStart(2, '0');
          const day = String(row.fecha.getDate()).padStart(2, '0');
          const fechaLocal = `${year}-${month}-${day}`;
          return fechaLocal === fechaInfo.fecha;
        });
        
        if (datos) {
          const resultado = {
            fecha: fechaInfo.fecha,
            promedio_pm10: parseFloat(datos.valor),
            tipo: 'historico',
            estado: datos.estado
          };
          datosCompletos.push(resultado);
          ultimoValorHistorico = parseFloat(datos.valor); // Guardar para predicciones
        }
        // Si no hay dato histórico, simplemente no lo incluimos (NO Math.random)
        
      } else { // prediccion
        datos = predicciones.rows.find(row => {
          const year = row.fecha.getFullYear();
          const month = String(row.fecha.getMonth() + 1).padStart(2, '0');
          const day = String(row.fecha.getDate()).padStart(2, '0');
          const fechaLocal = `${year}-${month}-${day}`;
          return fechaLocal === fechaInfo.fecha;
        });
        
        if (datos) {
          datosCompletos.push({
            fecha: fechaInfo.fecha,
            promedio_pm10: parseFloat(datos.valor),
            tipo: 'prediccion',
            estado: getEstadoPM25(datos.valor),
            modelo: datos.nombre_modelo,
            mae: datos.mae ? parseFloat(datos.mae) : null,
            roc_index: datos.roc_index ? parseFloat(datos.roc_index) : null
          });
        } else if (ultimoValorHistorico !== null) {
          // Fallback inteligente: usar último valor histórico para predicciones (SIN Math.random)
          datosCompletos.push({
            fecha: fechaInfo.fecha,
            promedio_pm10: ultimoValorHistorico,
            tipo: 'prediccion',
            estado: getEstadoPM25(ultimoValorHistorico),
            modelo: 'Fallback_Ultimo_Historico',
            mae: null,
            roc_index: null
          });
        }
        // Si no hay predicción ni último histórico, no incluimos nada (NO Math.random)
      }
    });
    
    console.log('✅ Datos completos generados:', datosCompletos.length);
    
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

