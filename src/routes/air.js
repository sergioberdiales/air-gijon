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

// Endpoint de evolución con fallback simple
router.get('/constitucion/evolucion', async (req, res) => {
  try {
    console.log('📊 Solicitando evolución de PM2.5...');
    
    // Generar datos de fallback por ahora (como funcionaba el 11 de junio)
    const hoy = new Date();
    const datosEmergencia = [];
    
    for (let i = 5; i >= -1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      const tipo = i > 0 ? 'historico' : 'prediccion';
      const valor = 15 + Math.random() * 10;
      
      const dato = {
        fecha: fechaStr,
        promedio_pm10: Math.round(valor * 100) / 100,
        tipo: tipo,
        estado: getEstadoPM25(valor)
      };
      
      if (tipo === 'prediccion') {
        dato.modelo = 'Modelo_0.0';
        dato.roc_index = 0.65;
      }
      
      datosEmergencia.push(dato);
    }
    
    res.json({
      estacion: "Avenida Constitución",
      datos: datosEmergencia,
      total_dias: datosEmergencia.length,
      fallback: true,
      generado_en: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo evolución:', error);
    res.status(500).json({ error: 'Error consultando evolución' });
  }
});

module.exports = router;

