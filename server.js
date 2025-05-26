const express = require('express');
const cors = require('cors');
const { pool, createTables, createIndexes, testConnection } = require('./db');
const { obtenerEvolucion } = require('./promedios_predicciones');
const app = express();
const PORT = process.env.PORT || 3000;

// Permitir CORS solo desde el frontend en Render
app.use(cors({
  origin: 'https://air-gijon-front-end.onrender.com'
}));

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

// Endpoint para obtener evolución de PM10 (últimos 5 días + predicciones)
app.get('/api/air/constitucion/evolucion', async (req, res) => {
  try {
    const evolucion = await obtenerEvolucion();
    
    if (evolucion.length === 0) {
      return res.status(404).json({ error: 'No hay datos de evolución disponibles' });
    }
    
    // Formatear datos para el frontend
    const datosFormateados = evolucion.map(dia => ({
      fecha: dia.fecha,
      promedio_pm10: parseFloat(dia.promedio_pm10),
      tipo: dia.tipo,
      estado: getEstadoPM10(parseFloat(dia.promedio_pm10)),
      confianza: dia.confianza ? parseFloat(dia.confianza) : null,
      datos_utilizados: dia.datos_utilizados || null,
      algoritmo: dia.algoritmo || null
    }));
    
    res.json({
      estacion: "Avenida Constitución",
      datos: datosFormateados,
      total_dias: datosFormateados.length,
      historicos: datosFormateados.filter(d => d.tipo === 'historico').length,
      predicciones: datosFormateados.filter(d => d.tipo === 'prediccion').length
    });
  } catch (error) {
    console.error('Error obteniendo evolución:', error);
    res.status(500).json({ error: 'Error consultando la evolución de datos' });
  }
});

// Inicializar base de datos y servidor
async function initializeServer() {
  try {
    console.log('🔗 Conectando a la base de datos...');
    console.log('DATABASE_URL configurada:', process.env.DATABASE_URL ? 'Sí' : 'No');
    
    await testConnection();
    await createTables();
    await createIndexes();
    
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error inicializando servidor:', error);
    process.exit(1);
  }
}

initializeServer(); 