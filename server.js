const express = require('express');
const { pool } = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

// Función para calcular el estado de calidad del aire según PM10
function getEstadoPM10(pm10) {
  if (pm10 <= 40) return 'Buena';
  if (pm10 <= 50) return 'Moderada';
  if (pm10 <= 100) return 'Regular';
  return 'Mala';
}

// Endpoint para obtener el último valor de PM10 de AQICN para la estación Constitución
app.get('/api/air/constitucion/pm10', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fecha, valor AS pm10
       FROM mediciones_api
       WHERE estacion_id = '6699' AND parametro = 'pm10'
       ORDER BY fecha DESC
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hay datos disponibles' });
    }
    const pm10 = parseFloat(result.rows[0].pm10);
    res.json({
      estacion: "Avenida Constitución",
      fecha: result.rows[0].fecha,
      pm10,
      estado: getEstadoPM10(pm10)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error consultando la base de datos' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
}); 