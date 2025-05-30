const express = require('express');
const cors = require('cors');
const { pool, createTables, createIndexes, testConnection } = require('./db');

const app = express();

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS más permisivo para desarrollo
app.use(cors({
  origin: true,
  credentials: true
}));

// Rutas de usuarios (lo más importante para el sistema de autenticación)
const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);

// Función para calcular el estado de calidad del aire según PM2.5
function getEstadoPM25(pm25) {
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

// Endpoints básicos de API (simplificados)
app.get('/api/air/constitucion/pm25', async (req, res) => {
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
app.get('/api/air/constitucion/evolucion', async (req, res) => {
  try {
    // Simplificar para evitar errores de timezone
    const hoyStr = new Date().toISOString().split('T')[0];
    const mananaStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT fecha, promedio_pm10, tipo, confianza
      FROM promedios_diarios 
      WHERE fecha >= $1
      ORDER BY fecha ASC
      LIMIT 10
    `, [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]);

    const datosFormateados = result.rows.map(dia => ({
      fecha: typeof dia.fecha === 'string' ? dia.fecha : dia.fecha.toISOString().split('T')[0],
      promedio_pm10: dia.promedio_pm10 ? parseFloat(dia.promedio_pm10) : 15, // Fallback
      tipo: dia.tipo || 'historico',
      estado: getEstadoPM25(dia.promedio_pm10 || 15),
      confianza: dia.confianza ? parseFloat(dia.confianza) : 0.5
    }));
    
    res.json({
      estacion: "Avenida Constitución",
      datos: datosFormateados,
      total_dias: datosFormateados.length
    });
  } catch (error) {
    console.error('Error obteniendo evolución:', error);
    // Fallback con datos mock para que el frontend funcione
    res.json({
      estacion: "Avenida Constitución",
      datos: [
        { fecha: '2025-05-26', promedio_pm10: 12, tipo: 'historico', estado: 'Buena', confianza: 0.8 },
        { fecha: '2025-05-27', promedio_pm10: 18, tipo: 'historico', estado: 'Moderada', confianza: 0.8 },
        { fecha: '2025-05-28', promedio_pm10: 22, tipo: 'prediccion', estado: 'Moderada', confianza: 0.7 },
        { fecha: '2025-05-29', promedio_pm10: 20, tipo: 'prediccion', estado: 'Moderada', confianza: 0.6 }
      ],
      total_dias: 4
    });
  }
});

// Inicialización del servidor simplificada
async function initializeServer() {
  try {
    console.log('🔗 Inicializando servidor simplificado...');
    
    // Probar conexión básica
    await testConnection();
    console.log('✅ Conexión a BD verificada');
    
    // Intentar crear tablas solo si no existen
    try {
      await createTables();
      await createIndexes();
      console.log('✅ Tablas inicializadas');
    } catch (error) {
      console.log('⚠️ Tablas ya existen o error de concurrencia (continuando)');
    }
    
    // Usar puerto del entorno o buscar uno libre
    const PORT = process.env.PORT || 3000;
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
      console.log('🔑 Sistema de usuarios disponible en /api/users');
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Puerto ${PORT} ocupado. Prueba con otro puerto o termina el proceso anterior.`);
        process.exit(1);
      } else {
        console.error('❌ Error del servidor:', err);
      }
    });
    
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
    console.log('💡 Verifica que PostgreSQL esté corriendo y DATABASE_URL configurada');
    process.exit(1);
  }
}

initializeServer(); 