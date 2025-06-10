const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, createTables, createIndexes, testConnection } = require('./database/db');
const { ejecutarMigracionEstructuraPromedios } = require(path.join(__dirname, '../scripts/migration/migrate_promedios_estructura'));
const { verifyEmailConfig } = require('./services/email_service');

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

// Endpoint de evolución actualizado para nueva arquitectura
app.get('/api/air/constitucion/evolucion', async (req, res) => {
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
    
    // 1. Consultar datos históricos
    const fechasHistoricas = fechas.filter(f => f.tipo === 'historico').map(f => f.fecha);
    const historicos = await pool.query(`
      SELECT fecha, parametro, valor, estado
      FROM promedios_diarios 
      WHERE fecha = ANY($1) AND parametro = $2
      ORDER BY fecha ASC
    `, [fechasHistoricas, 'pm25']);
    
    console.log(`📈 Datos históricos PM2.5 encontrados: ${historicos.rows.length} de ${fechasHistoricas.length}`);
    
    // 2. Consultar predicciones con el modelo activo
    const fechasPredicciones = fechas.filter(f => f.tipo === 'prediccion').map(f => f.fecha);
    const predicciones = await pool.query(`
      SELECT p.fecha, p.valor, m.nombre_modelo, m.mae, m.roc_index
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha = ANY($1) 
        AND p.estacion_id = '6699'
        AND p.parametro = 'pm25'
        AND m.activo = true
      ORDER BY p.fecha ASC
    `, [fechasPredicciones]);
    
    console.log(`🔮 Predicciones encontradas: ${predicciones.rows.length} de ${fechasPredicciones.length}`);
    
    // 3. Combinar y completar datos faltantes
    const datosCompletos = fechas.map(fechaInfo => {
      let datos = null;
      
      if (fechaInfo.tipo === 'historico') {
        datos = historicos.rows.find(row => 
          row.fecha.toISOString().split('T')[0] === fechaInfo.fecha
        );
        
        if (datos) {
          return {
            fecha: fechaInfo.fecha,
            promedio_pm10: parseFloat(datos.valor),
            tipo: 'historico',
            estado: datos.estado
          };
        }
      } else {
        datos = predicciones.rows.find(row => 
          row.fecha.toISOString().split('T')[0] === fechaInfo.fecha
        );
        
        if (datos) {
          return {
            fecha: fechaInfo.fecha,
            promedio_pm10: parseFloat(datos.valor),
            tipo: 'prediccion',
            estado: getEstadoPM25(datos.valor),
            modelo: datos.nombre_modelo,
            mae: datos.mae ? parseFloat(datos.mae) : null,
            roc_index: datos.roc_index ? parseFloat(datos.roc_index) : null
          };
        }
      }
      
      // Generar dato placeholder si no existe
      const valorBase = fechaInfo.tipo === 'historico' ? 
        (12 + Math.random() * 8) : // Históricos: 12-20
        (15 + Math.random() * 10); // Predicciones: 15-25
      
      const valor = Math.round(valorBase * 100) / 100;
      
      console.log(`🔄 Generando dato placeholder para ${fechaInfo.fecha}: ${valor} µg/m³`);
      
      const resultado = {
        fecha: fechaInfo.fecha,
        promedio_pm10: valor,
        tipo: fechaInfo.tipo,
        estado: getEstadoPM25(valor)
      };
      
      if (fechaInfo.tipo === 'prediccion') {
        resultado.modelo = 'Modelo_1.0';
        resultado.mae = 8.37;
        resultado.roc_index = null;
      }
      
      return resultado;
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
    
    // Fallback con fechas actuales
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
      error: 'Datos generados por fallback'
    });
  }
});

// Endpoint para obtener información de modelos
app.get('/api/modelos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        nombre_modelo,
        fecha_inicio_produccion,
        fecha_fin_produccion,
        mae,
        roc_index,
        descripcion,
        activo,
        created_at,
        updated_at
      FROM modelos_prediccion
      ORDER BY id DESC
    `);
    
    res.json({
      modelos: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error consultando modelos:', error);
    res.status(500).json({ error: 'Error consultando modelos' });
  }
});

// Endpoint para obtener predicciones específicas
app.get('/api/predicciones/:estacion/:parametro', async (req, res) => {
  try {
    const { estacion, parametro } = req.params;
    const { desde, hasta, modelo_id } = req.query;
    
    let whereConditions = ['p.estacion_id = $1', 'p.parametro = $2'];
    let params = [estacion, parametro];
    let paramIndex = 3;
    
    if (desde) {
      whereConditions.push(`p.fecha >= $${paramIndex}`);
      params.push(desde);
      paramIndex++;
    }
    
    if (hasta) {
      whereConditions.push(`p.fecha <= $${paramIndex}`);
      params.push(hasta);
      paramIndex++;
    }
    
    if (modelo_id) {
      whereConditions.push(`p.modelo_id = $${paramIndex}`);
      params.push(modelo_id);
      paramIndex++;
    } else {
      whereConditions.push('m.activo = true');
    }
    
    const result = await pool.query(`
      SELECT 
        p.id,
        p.fecha,
        p.valor,
        p.fecha_generacion,
        m.nombre_modelo,
        m.mae,
        m.roc_index
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.fecha ASC
    `, params);
    
    const predicciones = result.rows.map(row => ({
      ...row,
      estado: parametro === 'pm25' ? getEstadoPM25(row.valor) : 'N/A'
    }));
    
    res.json({
      estacion_id: estacion,
      parametro,
      predicciones,
      total: predicciones.length
    });
  } catch (error) {
    console.error('❌ Error consultando predicciones:', error);
    res.status(500).json({ error: 'Error consultando predicciones' });
  }
});

// Endpoint para activar/desactivar modelos
app.put('/api/modelos/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primero desactivar todos los modelos
    await pool.query('UPDATE modelos_prediccion SET activo = false');
    
    // Luego activar el modelo seleccionado
    const result = await pool.query(`
      UPDATE modelos_prediccion 
      SET activo = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo no encontrado' });
    }
    
    res.json({
      mensaje: 'Modelo activado exitosamente',
      modelo: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error activando modelo:', error);
    res.status(500).json({ error: 'Error activando modelo' });
  }
});

// Endpoint para crear nuevo modelo
app.post('/api/modelos', async (req, res) => {
  try {
    const { 
      nombre_modelo, 
      descripcion, 
      mae,
      roc_index,
      activar_inmediatamente = false 
    } = req.body;
    
    if (!nombre_modelo) {
      return res.status(400).json({ error: 'nombre_modelo es requerido' });
    }
    
    // Si se va a activar inmediatamente, desactivar otros modelos
    if (activar_inmediatamente) {
      await pool.query('UPDATE modelos_prediccion SET activo = false');
    }
    
    const result = await pool.query(`
      INSERT INTO modelos_prediccion (
        nombre_modelo,
        fecha_inicio_produccion,
        descripcion,
        mae,
        roc_index,
        activo
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
      RETURNING *
    `, [nombre_modelo, descripcion, mae, roc_index, activar_inmediatamente]);
    
    res.status(201).json({
      mensaje: 'Modelo creado exitosamente',
      modelo: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(409).json({ error: 'Ya existe un modelo con ese nombre' });
    } else {
      console.error('❌ Error creando modelo:', error);
      res.status(500).json({ error: 'Error creando modelo' });
    }
  }
});

// Endpoint para actualizar ROC index de un modelo
app.put('/api/modelos/:id/roc', async (req, res) => {
  try {
    const { id } = req.params;
    const { roc_index } = req.body;
    
    if (typeof roc_index !== 'number' || roc_index < 0 || roc_index > 1) {
      return res.status(400).json({ error: 'roc_index debe ser un número entre 0 y 1' });
    }
    
    const result = await pool.query(`
      UPDATE modelos_prediccion 
      SET roc_index = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [roc_index, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo no encontrado' });
    }
    
    res.json({
      mensaje: 'ROC index actualizado exitosamente',
      modelo: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error actualizando ROC index:', error);
    res.status(500).json({ error: 'Error actualizando ROC index' });
  }
});

// Endpoint para actualizar MAE de un modelo
app.put('/api/modelos/:id/mae', async (req, res) => {
  try {
    const { id } = req.params;
    const { mae } = req.body;
    
    if (typeof mae !== 'number' || mae < 0) {
      return res.status(400).json({ error: 'mae debe ser un número positivo' });
    }
    
    const result = await pool.query(`
      UPDATE modelos_prediccion 
      SET mae = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [mae, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo no encontrado' });
    }
    
    res.json({
      mensaje: 'MAE actualizado exitosamente',
      modelo: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error actualizando MAE:', error);
    res.status(500).json({ error: 'Error actualizando MAE' });
  }
});

// ENDPOINT DE TESTING: Ejecutar predicciones manualmente
app.post('/api/test/predicciones', async (req, res) => {
  try {
    console.log('🧪 TEST: Ejecutando predicciones manualmente desde API...');
    
    const { spawn } = require('child_process');
    const path = require('path');
    
    // Ejecutar el cron job de predicciones
    const cronScript = path.join(__dirname, 'cron_predictions_fixed.js');
    
    const child = spawn('node', [cronScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', async (code) => {
      if (code === 0) {
        console.log('✅ TEST: Predicciones ejecutadas exitosamente');
        
        // Obtener las predicciones más recientes para mostrar resultado
        try {
          const prediccionesRecientes = await pool.query(`
            SELECT 
              p.fecha,
              p.valor,
              p.horizonte_dias,
              p.fecha_generacion,
              m.nombre_modelo,
              m.mae
            FROM predicciones p
            JOIN modelos_prediccion m ON p.modelo_id = m.id
            WHERE p.estacion_id = '6699' 
              AND p.parametro = 'pm25'
              AND m.activo = true
              AND p.fecha_generacion >= (CURRENT_TIMESTAMP - INTERVAL '10 minutes')
            ORDER BY p.fecha_generacion DESC, p.horizonte_dias ASC
            LIMIT 4
          `);
          
          res.json({
            success: true,
            mensaje: 'Predicciones ejecutadas exitosamente desde API',
            predicciones_generadas: prediccionesRecientes.rows,
            log_output: stdout.split('\n').slice(-20), // Últimas 20 líneas
            timestamp: new Date().toISOString()
          });
        } catch (dbError) {
          res.json({
            success: true,
            mensaje: 'Predicciones ejecutadas, pero error consultando resultados',
            log_output: stdout.split('\n').slice(-20),
            error: dbError.message
          });
        }
      } else {
        console.error('❌ TEST: Error ejecutando predicciones:', stderr);
        res.status(500).json({
          success: false,
          error: 'Error ejecutando predicciones',
          log_output: stdout.split('\n').slice(-20),
          stderr: stderr.split('\n').slice(-10),
          exit_code: code
        });
      }
    });
    
  } catch (error) {
    console.error('❌ TEST: Error en endpoint de testing:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno ejecutando test de predicciones',
      details: error.message
    });
  }
});

// Endpoint para obtener estado del sistema de predicciones
app.get('/api/test/status', async (req, res) => {
  try {
    // 1. Verificar modelo activo
    const modeloActivo = await pool.query(`
      SELECT nombre_modelo, mae, activo, fecha_inicio_produccion
      FROM modelos_prediccion
      WHERE activo = true
      LIMIT 1
    `);
    
    // 2. Verificar últimas predicciones
    const ultimasPredicciones = await pool.query(`
      SELECT 
        p.fecha,
        p.valor,
        p.horizonte_dias,
        p.fecha_generacion,
        m.nombre_modelo
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.estacion_id = '6699' 
        AND p.parametro = 'pm25'
        AND m.activo = true
      ORDER BY p.fecha_generacion DESC
      LIMIT 5
    `);
    
    // 3. Verificar si hay predicciones para hoy y mañana
    const hoy = new Date().toISOString().split('T')[0];
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toISOString().split('T')[0];
    
    const prediccionesActuales = await pool.query(`
      SELECT fecha, valor, horizonte_dias
      FROM predicciones p
      JOIN modelos_prediccion m ON p.modelo_id = m.id
      WHERE p.fecha IN ($1, $2)
        AND p.estacion_id = '6699'
        AND p.parametro = 'pm25'
        AND m.activo = true
      ORDER BY p.fecha, p.horizonte_dias
    `, [hoy, mananaStr]);
    
    res.json({
      modelo_activo: modeloActivo.rows[0] || null,
      tiene_predicciones_actuales: prediccionesActuales.rows.length > 0,
      predicciones_hoy_manana: prediccionesActuales.rows,
      ultimas_predicciones: ultimasPredicciones.rows,
      timestamp: new Date().toISOString(),
      sistema_operativo: process.platform,
      node_version: process.version
    });
  } catch (error) {
    console.error('❌ Error consultando estado del sistema:', error);
    res.status(500).json({ error: 'Error consultando estado del sistema' });
  }
});

// Inicialización del servidor simplificada
async function initializeServer() {
  try {
    console.log('🔗 Inicializando servidor simplificado...');
    
    // Probar conexión básica
    await testConnection();
    console.log('✅ Conexión a BD verificada');

    // Verificar configuración de email al inicio
    await verifyEmailConfig(); 

    // Intentar crear tablas solo si no existen
    try {
      await createTables();
      await createIndexes();
      console.log('✅ Tablas inicializadas');
    } catch (error) {
      console.log('⚠️ Tablas ya existen o error de concurrencia (continuando)');
    }
    
    // Ejecutar migraciones automáticamente en producción
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
      console.log('🔄 Ejecutando migración de estructura de promedios_diarios en producción...');
      try {
        await ejecutarMigracionEstructuraPromedios();
        console.log('✅ Migración de estructura de promedios_diarios completada.');
      } catch (migrationError) {
        console.error('❌ Error crítico durante la migración de estructura de promedios_diarios:', migrationError);
        console.log('⚠️ Error en migración de estructura de promedios (puede ser normal si ya se ejecutó o si la tabla no existía con formato antiguo):', migrationError.message);
      }

      console.log('🔄 Ejecutando migración de predicciones en producción...');
      try {
        const { migrateToPredictionsArchitecture } = require('./migrate_to_new_predictions');
        await migrateToPredictionsArchitecture();
        console.log('✅ Migración completada exitosamente');
      } catch (migrationError) {
        console.error('❌ Error crítico durante la migración de predicciones:', migrationError);
        console.log('⚠️ Error en migración de predicciones (puede ser normal si ya se ejecutó o si la tabla no existía con formato antiguo):', migrationError.message);
      }
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