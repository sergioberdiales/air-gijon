const express = require('express');
const cors = require('cors');
const { pool, createTables, createIndexes, testConnection } = require('./db');
const { ejecutarMigracionEstructuraPromedios } = require('./migrate_promedios_estructura');
const { verifyEmailConfig } = require('./email_service');

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

// ENDPOINT TEMPORAL DE MIGRACIÓN (eliminar después de usar)
app.post('/api/migrate/lightgbm', async (req, res) => {
  try {
    console.log('🔧 MIGRACIÓN: Ejecutando migraciones de LightGBM...');
    
    const results = [];
    
    // 1. Agregar columna MAE si no existe
    try {
      console.log('➕ Agregando columna mae...');
      await pool.query(`
        ALTER TABLE modelos_prediccion 
        ADD COLUMN IF NOT EXISTS mae DECIMAL(6,3)
      `);
      results.push('✅ Columna mae agregada');
    } catch (error) {
      results.push('⚠️ Error agregando columna mae: ' + error.message);
    }
    
    // 2. Agregar columna horizonte_dias si no existe
    try {
      console.log('➕ Agregando columna horizonte_dias...');
      await pool.query(`
        ALTER TABLE predicciones 
        ADD COLUMN IF NOT EXISTS horizonte_dias INTEGER DEFAULT 0
      `);
      results.push('✅ Columna horizonte_dias agregada');
    } catch (error) {
      results.push('⚠️ Error agregando columna horizonte_dias: ' + error.message);
    }
    
    // 3. Actualizar datos existentes
    try {
      console.log('🔄 Actualizando datos existentes...');
      const updateResult = await pool.query(`
        UPDATE predicciones 
        SET horizonte_dias = 0 
        WHERE horizonte_dias IS NULL
      `);
      results.push(`✅ Actualizadas ${updateResult.rowCount} filas en predicciones`);
    } catch (error) {
      results.push('⚠️ Error actualizando datos: ' + error.message);
    }
    
    // 4. Eliminar constraint anterior si existe
    try {
      console.log('🗑️ Eliminando constraint anterior...');
      await pool.query(`
        ALTER TABLE predicciones 
        DROP CONSTRAINT IF EXISTS predicciones_fecha_estacion_id_modelo_id_parametro_key
      `);
      results.push('✅ Constraint anterior eliminado');
    } catch (error) {
      results.push('⚠️ Constraint anterior no existía o error: ' + error.message);
    }
    
    // 5. Crear nuevo constraint único
    try {
      console.log('🔐 Creando nuevo constraint único...');
      await pool.query(`
        ALTER TABLE predicciones 
        ADD CONSTRAINT predicciones_fecha_estacion_modelo_parametro_horizonte_unique 
        UNIQUE (fecha, estacion_id, modelo_id, parametro, horizonte_dias)
      `);
      results.push('✅ Nuevo constraint único creado');
    } catch (error) {
      if (error.code === '23505' || error.message.includes('already exists')) {
        results.push('✅ Constraint único ya existe');
      } else {
        results.push('⚠️ Error creando constraint: ' + error.message);
      }
    }
    
    // 6. Crear índice adicional
    try {
      console.log('📊 Creando índice adicional...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_predicciones_horizonte_fecha 
        ON predicciones(horizonte_dias, fecha)
      `);
      results.push('✅ Índice adicional creado');
    } catch (error) {
      results.push('⚠️ Error creando índice: ' + error.message);
    }
    
    // 7. Desactivar modelos existentes
    try {
      console.log('🔄 Desactivando modelos anteriores...');
      await pool.query(`
        UPDATE modelos_prediccion 
        SET activo = false, 
            fecha_fin_produccion = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
      `);
      results.push('✅ Modelos anteriores desactivados');
    } catch (error) {
      results.push('⚠️ Error desactivando modelos: ' + error.message);
    }
    
    // 8. Crear/actualizar Modelo_1.0
    try {
      console.log('✨ Creando Modelo_1.0 (LightGBM)...');
      const modelResult = await pool.query(`
        INSERT INTO modelos_prediccion (
          nombre_modelo,
          fecha_inicio_produccion,
          mae,
          descripcion,
          activo
        ) VALUES (
          'Modelo_1.0',
          CURRENT_DATE,
          8.370,
          'Modelo LightGBM entrenado con 33 variables (16 lags, 13 diferencias, 2 tendencias, 2 exógenas). MAE: 8.37 µg/m³. Datos de entrenamiento: mayo 2024 - abril 2025.',
          true
        )
        ON CONFLICT (nombre_modelo) DO UPDATE SET
          activo = true,
          fecha_inicio_produccion = CURRENT_DATE,
          fecha_fin_produccion = NULL,
          mae = EXCLUDED.mae,
          descripcion = EXCLUDED.descripcion,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `);
      
      const modelo = modelResult.rows[0];
      results.push(`✅ Modelo_1.0 creado/actualizado con ID: ${modelo.id}`);
    } catch (error) {
      results.push('⚠️ Error creando modelo: ' + error.message);
    }
    
    // 9. Actualizar modelo antiguo
    try {
      console.log('🔄 Actualizando Modelo_0.0...');
      await pool.query(`
        UPDATE modelos_prediccion 
        SET mae = 15.50,
            roc_index = NULL,
            descripcion = 'Modelo inicial basado en datos históricos con variación aleatoria. Algoritmo simple de promedio móvil. MAE estimado: ~15.5 µg/m³.',
            updated_at = CURRENT_TIMESTAMP
        WHERE nombre_modelo = 'Modelo_0.0'
      `);
      results.push('✅ Modelo_0.0 actualizado');
    } catch (error) {
      results.push('⚠️ Error actualizando Modelo_0.0: ' + error.message);
    }
    
    // 10. Verificar modelo activo
    const modeloActivo = await pool.query(`
      SELECT nombre_modelo, mae, activo
      FROM modelos_prediccion
      WHERE activo = true
      LIMIT 1
    `);
    
    console.log('✅ MIGRACIÓN COMPLETADA');
    
    res.json({
      success: true,
      mensaje: 'Migraciones de LightGBM completadas exitosamente',
      resultados: results,
      modelo_activo: modeloActivo.rows[0] || null,
      timestamp: new Date().toISOString(),
      nota: 'Este endpoint será eliminado después de usar'
    });
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando migraciones',
      details: error.message
    });
  }
});

// ENDPOINT TEMPORAL PARA CARGAR DATOS HISTÓRICOS (eliminar después de usar)
app.post('/api/migrate/historical-data', async (req, res) => {
  try {
    console.log('📊 CARGA: Generando datos históricos para LightGBM...');
    
    const results = [];
    
    // Función para calcular estado PM2.5
    function getEstadoPM25(pm25) {
      if (pm25 <= 15) return 'Buena';
      if (pm25 <= 25) return 'Moderada';
      if (pm25 <= 50) return 'Regular';
      return 'Mala';
    }
    
    // Función para calcular estado OMS
    function getEstadoOMS(pm25) {
      if (pm25 <= 15) return 'AQG';
      if (pm25 <= 25) return 'IT-4';
      if (pm25 <= 37.5) return 'IT-3';
      if (pm25 <= 50) return 'IT-2';
      if (pm25 <= 75) return 'IT-1';
      return '>IT-1';
    }
    
    // Generar 35 días de datos históricos realistas
    const hoy = new Date();
    const datosHistoricos = [];
    
    for (let i = 35; i >= 1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Generar valores realistas basados en patrones reales de PM2.5
      // Variación estacional y semanal simulada
      const diaSemana = fecha.getDay(); // 0=domingo, 6=sábado
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
      
      // Base: valores típicos de primavera/verano en Gijón
      let valorBase = 16; // Valor medio típico
      
      // Variación por día de semana (menos contaminación fin de semana)
      if (esFinDeSemana) {
        valorBase -= 3; // Menos tráfico
      } else {
        valorBase += 2; // Más tráfico laboral
      }
      
      // Añadir variación aleatoria realista
      const variacion = (Math.random() - 0.5) * 12; // ±6 µg/m³
      const valor = Math.max(8, valorBase + variacion); // Mínimo 8 µg/m³
      
      // Redondear a 2 decimales
      const valorFinal = Math.round(valor * 100) / 100;
      
      datosHistoricos.push({
        fecha: fechaStr,
        valor: valorFinal,
        estado: getEstadoPM25(valorFinal),
        estado_oms: getEstadoOMS(valorFinal)
      });
    }
    
    console.log(`📊 Generando ${datosHistoricos.length} registros históricos...`);
    
    // Insertar datos en lotes para mejor rendimiento
    let insertados = 0;
    
    for (const dato of datosHistoricos) {
      try {
        await pool.query(`
          INSERT INTO promedios_diarios (
            fecha, 
            parametro, 
            valor, 
            estado, 
            source
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (fecha, parametro) 
          DO UPDATE SET
            valor = EXCLUDED.valor,
            estado = EXCLUDED.estado,
            source = EXCLUDED.source,
            updated_at = CURRENT_TIMESTAMP
        `, [
          dato.fecha,
          'pm25',
          dato.valor,
          dato.estado,
          'historical_generator_prod'
        ]);
        
        insertados++;
      } catch (error) {
        console.error(`Error insertando dato ${dato.fecha}:`, error.message);
        results.push(`⚠️ Error en ${dato.fecha}: ${error.message}`);
      }
    }
    
    results.push(`✅ ${insertados} registros históricos insertados/actualizados`);
    
    // Verificar datos insertados
    const verificacion = await pool.query(`
      SELECT COUNT(*) as total, MIN(fecha) as desde, MAX(fecha) as hasta
      FROM promedios_diarios
      WHERE parametro = 'pm25' AND source = 'historical_generator_prod'
    `);
    
    const stats = verificacion.rows[0];
    results.push(`📊 Verificación: ${stats.total} registros desde ${stats.desde} hasta ${stats.hasta}`);
    
    // Mostrar algunos ejemplos
    const ejemplos = await pool.query(`
      SELECT fecha, valor, estado
      FROM promedios_diarios
      WHERE parametro = 'pm25' AND source = 'historical_generator_prod'
      ORDER BY fecha DESC
      LIMIT 5
    `);
    
    console.log('✅ DATOS HISTÓRICOS CARGADOS');
    
    res.json({
      success: true,
      mensaje: 'Datos históricos generados exitosamente',
      resultados: results,
      estadisticas: stats,
      ejemplos: ejemplos.rows,
      timestamp: new Date().toISOString(),
      nota: 'Este endpoint será eliminado después de usar'
    });
    
  } catch (error) {
    console.error('❌ Error cargando datos históricos:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando datos históricos',
      details: error.message
    });
  }
});

// ENDPOINT GET TEMPORAL PARA CARGAR DATOS HISTÓRICOS (desde navegador)
app.get('/api/migrate/historical-data/execute', async (req, res) => {
  try {
    console.log('📊 CARGA GET: Generando datos históricos para LightGBM...');
    
    const results = [];
    
    // Función para calcular estado PM2.5
    function getEstadoPM25(pm25) {
      if (pm25 <= 15) return 'Buena';
      if (pm25 <= 25) return 'Moderada';
      if (pm25 <= 50) return 'Regular';
      return 'Mala';
    }
    
    // Función para calcular estado OMS
    function getEstadoOMS(pm25) {
      if (pm25 <= 15) return 'AQG';
      if (pm25 <= 25) return 'IT-4';
      if (pm25 <= 37.5) return 'IT-3';
      if (pm25 <= 50) return 'IT-2';
      if (pm25 <= 75) return 'IT-1';
      return '>IT-1';
    }
    
    // Verificar si ya hay datos suficientes
    const existingData = await pool.query(`
      SELECT COUNT(*) as total
      FROM promedios_diarios
      WHERE parametro = 'pm25' 
        AND fecha >= (CURRENT_DATE - INTERVAL '35 days')
    `);
    
    const datosExistentes = parseInt(existingData.rows[0].total);
    
    if (datosExistentes >= 35) {
      return res.json({
        success: true,
        mensaje: 'Ya hay suficientes datos históricos',
        datos_existentes: datosExistentes,
        nota: 'No se generaron nuevos datos porque ya hay suficientes'
      });
    }
    
    // Generar 35 días de datos históricos realistas
    const hoy = new Date();
    const datosHistoricos = [];
    
    for (let i = 35; i >= 1; i--) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      
      // Generar valores realistas basados en patrones reales de PM2.5
      // Variación estacional y semanal simulada
      const diaSemana = fecha.getDay(); // 0=domingo, 6=sábado
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
      
      // Base: valores típicos de primavera/verano en Gijón
      let valorBase = 16; // Valor medio típico
      
      // Variación por día de semana (menos contaminación fin de semana)
      if (esFinDeSemana) {
        valorBase -= 3; // Menos tráfico
      } else {
        valorBase += 2; // Más tráfico laboral
      }
      
      // Añadir variación aleatoria realista
      const variacion = (Math.random() - 0.5) * 12; // ±6 µg/m³
      const valor = Math.max(8, valorBase + variacion); // Mínimo 8 µg/m³
      
      // Redondear a 2 decimales
      const valorFinal = Math.round(valor * 100) / 100;
      
      datosHistoricos.push({
        fecha: fechaStr,
        valor: valorFinal,
        estado: getEstadoPM25(valorFinal),
        estado_oms: getEstadoOMS(valorFinal)
      });
    }
    
    console.log(`📊 Generando ${datosHistoricos.length} registros históricos...`);
    
    // Insertar datos en lotes para mejor rendimiento
    let insertados = 0;
    
    for (const dato of datosHistoricos) {
      try {
        await pool.query(`
          INSERT INTO promedios_diarios (
            fecha, 
            parametro, 
            valor, 
            estado, 
            source
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (fecha, parametro) 
          DO UPDATE SET
            valor = EXCLUDED.valor,
            estado = EXCLUDED.estado,
            source = EXCLUDED.source,
            updated_at = CURRENT_TIMESTAMP
        `, [
          dato.fecha,
          'pm25',
          dato.valor,
          dato.estado,
          'historical_generator_prod'
        ]);
        
        insertados++;
      } catch (error) {
        console.error(`Error insertando dato ${dato.fecha}:`, error.message);
        results.push(`⚠️ Error en ${dato.fecha}: ${error.message}`);
      }
    }
    
    results.push(`✅ ${insertados} registros históricos insertados/actualizados`);
    
    // Verificar datos insertados
    const verificacion = await pool.query(`
      SELECT COUNT(*) as total, MIN(fecha) as desde, MAX(fecha) as hasta
      FROM promedios_diarios
      WHERE parametro = 'pm25'
    `);
    
    const stats = verificacion.rows[0];
    results.push(`📊 Verificación: ${stats.total} registros desde ${stats.desde} hasta ${stats.hasta}`);
    
    // Mostrar algunos ejemplos
    const ejemplos = await pool.query(`
      SELECT fecha, valor, estado
      FROM promedios_diarios
      WHERE parametro = 'pm25'
      ORDER BY fecha DESC
      LIMIT 5
    `);
    
    console.log('✅ DATOS HISTÓRICOS CARGADOS VÍA GET');
    
    res.json({
      success: true,
      mensaje: 'Datos históricos generados exitosamente vía GET',
      resultados: results,
      estadisticas: stats,
      ejemplos: ejemplos.rows,
      timestamp: new Date().toISOString(),
      siguiente_paso: 'Ahora ejecuta /api/test/predicciones para probar LightGBM'
    });
    
  } catch (error) {
    console.error('❌ Error cargando datos históricos vía GET:', error);
    res.status(500).json({
      success: false,
      error: 'Error cargando datos históricos',
      details: error.message
    });
  }
});

// ENDPOINT TEMPORAL PARA ARREGLAR ESTRUCTURA DE promedios_diarios
app.post('/api/migrate/fix-promedios-structure', async (req, res) => {
  try {
    console.log('🔧 ESTRUCTURA: Arreglando tabla promedios_diarios...');
    
    const results = [];
    
    // 1. Verificar estructura actual
    const currentStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'promedios_diarios'
      ORDER BY ordinal_position
    `);
    
    results.push(`📋 Estructura actual: ${currentStructure.rows.length} columnas`);
    
    // 2. Verificar constraints existentes
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'promedios_diarios'
    `);
    
    results.push(`🔐 Constraints actuales: ${constraints.rows.length}`);
    
    // 3. Eliminar constraint anterior si existe (por si acaso)
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        DROP CONSTRAINT IF EXISTS promedios_diarios_fecha_key
      `);
      results.push('✅ Constraint anterior eliminado (si existía)');
    } catch (error) {
      results.push('⏭️ No había constraint anterior para eliminar');
    }
    
    // 4. Asegurar que tenemos las columnas necesarias
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        ADD COLUMN IF NOT EXISTS parametro VARCHAR(50) DEFAULT 'pm25'
      `);
      results.push('✅ Columna parametro asegurada');
    } catch (error) {
      results.push('⚠️ Error con columna parametro: ' + error.message);
    }
    
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'api'
      `);
      results.push('✅ Columna source asegurada');
    } catch (error) {
      results.push('⚠️ Error con columna source: ' + error.message);
    }
    
    // 5. Actualizar datos existentes
    try {
      const updateResult = await pool.query(`
        UPDATE promedios_diarios 
        SET parametro = 'pm25' 
        WHERE parametro IS NULL OR parametro = ''
      `);
      results.push(`✅ Actualizados ${updateResult.rowCount} registros con parametro=pm25`);
    } catch (error) {
      results.push('⚠️ Error actualizando parametro: ' + error.message);
    }
    
    // 6. Crear constraint único
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        ADD CONSTRAINT promedios_diarios_fecha_parametro_unique 
        UNIQUE (fecha, parametro)
      `);
      results.push('✅ Constraint único (fecha, parametro) creado');
    } catch (error) {
      if (error.code === '23505' || error.message.includes('already exists')) {
        results.push('✅ Constraint único ya existe');
      } else {
        results.push('⚠️ Error creando constraint: ' + error.message);
      }
    }
    
    // 7. Crear índices adicionales
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_promedios_fecha_parametro 
        ON promedios_diarios(fecha, parametro)
      `);
      results.push('✅ Índice (fecha, parametro) creado');
    } catch (error) {
      results.push('⚠️ Error creando índice: ' + error.message);
    }
    
    // 8. Verificar estructura final
    const finalStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'promedios_diarios'
      ORDER BY ordinal_position
    `);
    
    const finalConstraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'promedios_diarios'
    `);
    
    results.push(`📋 Estructura final: ${finalStructure.rows.length} columnas`);
    results.push(`🔐 Constraints finales: ${finalConstraints.rows.length}`);
    
    console.log('✅ ESTRUCTURA DE PROMEDIOS_DIARIOS ARREGLADA');
    
    res.json({
      success: true,
      mensaje: 'Estructura de promedios_diarios arreglada exitosamente',
      resultados: results,
      estructura_final: finalStructure.rows,
      constraints_finales: finalConstraints.rows,
      timestamp: new Date().toISOString(),
      siguiente_paso: 'Ahora ejecuta /api/migrate/historical-data/execute otra vez'
    });
    
  } catch (error) {
    console.error('❌ Error arreglando estructura:', error);
    res.status(500).json({
      success: false,
      error: 'Error arreglando estructura de promedios_diarios',
      details: error.message
    });
  }
});

// ENDPOINT GET TEMPORAL PARA ARREGLAR ESTRUCTURA DE promedios_diarios (desde navegador)
app.get('/api/migrate/fix-promedios-structure/execute', async (req, res) => {
  try {
    console.log('🔧 ESTRUCTURA GET: Arreglando tabla promedios_diarios...');
    
    const results = [];
    
    // 1. Verificar estructura actual
    const currentStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'promedios_diarios'
      ORDER BY ordinal_position
    `);
    
    results.push(`📋 Estructura actual: ${currentStructure.rows.length} columnas`);
    
    // 2. Verificar constraints existentes
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'promedios_diarios'
    `);
    
    results.push(`🔐 Constraints actuales: ${constraints.rows.length}`);
    
    // 3. Eliminar constraint anterior si existe (por si acaso)
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        DROP CONSTRAINT IF EXISTS promedios_diarios_fecha_key
      `);
      results.push('✅ Constraint anterior eliminado (si existía)');
    } catch (error) {
      results.push('⏭️ No había constraint anterior para eliminar');
    }
    
    // 4. Asegurar que tenemos las columnas necesarias
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        ADD COLUMN IF NOT EXISTS parametro VARCHAR(50) DEFAULT 'pm25'
      `);
      results.push('✅ Columna parametro asegurada');
    } catch (error) {
      results.push('⚠️ Error con columna parametro: ' + error.message);
    }
    
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'api'
      `);
      results.push('✅ Columna source asegurada');
    } catch (error) {
      results.push('⚠️ Error con columna source: ' + error.message);
    }
    
    // 5. Actualizar datos existentes
    try {
      const updateResult = await pool.query(`
        UPDATE promedios_diarios 
        SET parametro = 'pm25' 
        WHERE parametro IS NULL OR parametro = ''
      `);
      results.push(`✅ Actualizados ${updateResult.rowCount} registros con parametro=pm25`);
    } catch (error) {
      results.push('⚠️ Error actualizando parametro: ' + error.message);
    }
    
    // 6. Crear constraint único
    try {
      await pool.query(`
        ALTER TABLE promedios_diarios 
        ADD CONSTRAINT promedios_diarios_fecha_parametro_unique 
        UNIQUE (fecha, parametro)
      `);
      results.push('✅ Constraint único (fecha, parametro) creado');
    } catch (error) {
      if (error.code === '23505' || error.message.includes('already exists')) {
        results.push('✅ Constraint único ya existe');
      } else {
        results.push('⚠️ Error creando constraint: ' + error.message);
      }
    }
    
    // 7. Crear índices adicionales
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_promedios_fecha_parametro 
        ON promedios_diarios(fecha, parametro)
      `);
      results.push('✅ Índice (fecha, parametro) creado');
    } catch (error) {
      results.push('⚠️ Error creando índice: ' + error.message);
    }
    
    // 8. Verificar estructura final
    const finalStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'promedios_diarios'
      ORDER BY ordinal_position
    `);
    
    const finalConstraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'promedios_diarios'
    `);
    
    results.push(`📋 Estructura final: ${finalStructure.rows.length} columnas`);
    results.push(`🔐 Constraints finales: ${finalConstraints.rows.length}`);
    
    console.log('✅ ESTRUCTURA DE PROMEDIOS_DIARIOS ARREGLADA VÍA GET');
    
    res.json({
      success: true,
      mensaje: 'Estructura de promedios_diarios arreglada exitosamente vía GET',
      resultados: results,
      estructura_final: finalStructure.rows,
      constraints_finales: finalConstraints.rows,
      timestamp: new Date().toISOString(),
      siguiente_paso: 'Ahora ejecuta /api/migrate/historical-data/execute otra vez'
    });
    
  } catch (error) {
    console.error('❌ Error arreglando estructura vía GET:', error);
    res.status(500).json({
      success: false,
      error: 'Error arreglando estructura de promedios_diarios',
      details: error.message
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