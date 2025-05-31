const { Pool } = require('pg');

// Cargar variables de entorno solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Variable para controlar si las tablas ya están siendo inicializadas
let isInitializing = false;
let isInitialized = false;

// Verificar que DATABASE_URL esté configurada
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL no está configurada');
  console.log('Variables de entorno disponibles:', Object.keys(process.env).filter(key => key.includes('DB') || key.includes('DATABASE')));
  process.exit(1);
}

console.log('🔗 Conectando a la base de datos...');
console.log('DATABASE_URL configurada:', process.env.DATABASE_URL ? 'Sí' : 'No');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test de conexión
async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✅ Conexión a PostgreSQL exitosa:', result.rows[0].now);
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a PostgreSQL:', error);
        return false;
    }
}

async function createTables() {
  if (isInitializing) {
    console.log('⏳ Las tablas ya están siendo inicializadas por otro proceso...');
    return;
  }
  
  if (isInitialized) {
    return;
  }
  
  isInitializing = true;
  
  try {
    await createMedicionesApiTable();
    await createPromediosDiariosTable();
    await createUsersTable();
    await createPredictionMetricsTable();
    await createNotificationsTable();

    // Nueva tabla para modelos de predicción
    await pool.query(`
      CREATE TABLE IF NOT EXISTS modelos_prediccion (
        id SERIAL PRIMARY KEY,
        nombre_modelo VARCHAR(100) NOT NULL UNIQUE,
        fecha_inicio_produccion DATE NOT NULL,
        fecha_fin_produccion DATE,
        roc_index DECIMAL(5,4),
        descripcion TEXT,
        activo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Nueva tabla para predicciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS predicciones (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL,
        estacion_id VARCHAR(20) NOT NULL,
        modelo_id INTEGER NOT NULL REFERENCES modelos_prediccion(id),
        parametro VARCHAR(20) NOT NULL,
        valor DECIMAL(10,4) NOT NULL,
        fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fecha, estacion_id, modelo_id, parametro)
      )
    `);

    // Actualizar trigger para updated_at en modelos_prediccion
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_modelos_updated_at ON modelos_prediccion;
      CREATE TRIGGER update_modelos_updated_at
        BEFORE UPDATE ON modelos_prediccion
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    isInitialized = true;
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    if (error.message && error.message.includes('tuple concurrently updated')) {
      console.warn('⚠️ Error de concurrencia detectado, continuando...');
      setTimeout(() => {
        isInitialized = true;
      }, 5000);
      return;
    }
    throw error;
  } finally {
    isInitializing = false;
  }
}

async function createIndexes() {
  if (!isInitialized) {
    console.warn('⚠️ Las tablas no están inicializadas, saltando creación de índices');
    return;
  }
  
  try {
    console.log('Creando índices...');
    
    await createHistoricalIndexes();
    await createDailyAveragesIndexes();
    await createUserIndexes();

    // Índices para la nueva tabla predicciones
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_predicciones_fecha 
      ON predicciones(fecha)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_predicciones_estacion_fecha 
      ON predicciones(estacion_id, fecha)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_predicciones_parametro_fecha 
      ON predicciones(parametro, fecha)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_predicciones_modelo_fecha 
      ON predicciones(modelo_id, fecha)
    `);

    // Índices para la tabla modelos_prediccion
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_modelos_activo 
      ON modelos_prediccion(activo)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_modelos_fechas 
      ON modelos_prediccion(fecha_inicio_produccion, fecha_fin_produccion)
    `);

    console.log('✅ Índices creados');
  } catch (error) {
    console.error('Error creando índices:', error);
    throw error;
  }
}

// Función legacy para compatibilidad
async function createMedicionesApiTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS mediciones_api (
      id SERIAL PRIMARY KEY,
      fecha TIMESTAMP WITH TIME ZONE NOT NULL,
      pm25 REAL,
      pm10 REAL,
      estacion_id VARCHAR(50),
      parametro VARCHAR(20),
      valor REAL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_fecha_medicion UNIQUE (fecha)
    );
  `;
  
  await pool.query(createTableSQL);
  console.log('✅ Tabla mediciones_api creada/actualizada correctamente');
}

async function createPromediosDiariosTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS promedios_diarios (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL UNIQUE,
      pm25_promedio REAL,
      pm10_promedio REAL,
      tipo TEXT NOT NULL,
      confianza REAL,
      pm25_estado TEXT,
      pm10_estado TEXT,
      source TEXT DEFAULT 'calculated' NOT NULL,
      algoritmo TEXT,
      datos_utilizados INTEGER,
      detalles TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await pool.query(createTableSQL);
  console.log('✅ Tabla promedios_diarios creada/actualizada correctamente');
}

async function createHistoricalIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_mediciones_api_fecha ON mediciones_api(fecha DESC);',
    'CREATE INDEX IF NOT EXISTS idx_mediciones_api_estacion_fecha ON mediciones_api(estacion_id, fecha DESC);',
    'CREATE INDEX IF NOT EXISTS idx_mediciones_api_parametro_fecha ON mediciones_api(parametro, fecha DESC);',
    'CREATE INDEX IF NOT EXISTS idx_mediciones_api_created_at ON mediciones_api(created_at);'
  ];
  
  for (const indexSQL of indexes) {
    await pool.query(indexSQL);
  }
  console.log('✅ Índices para consultas históricas creados');
}

async function createDailyAveragesIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_promedios_fecha ON promedios_diarios(fecha DESC);',
    'CREATE INDEX IF NOT EXISTS idx_promedios_source ON promedios_diarios(source);',
    'CREATE INDEX IF NOT EXISTS idx_promedios_source_fecha ON promedios_diarios(source, fecha DESC);'
  ];
  
  for (const indexSQL of indexes) {
    await pool.query(indexSQL);
  }
  console.log('✅ Índices para promedios diarios creados');
}

async function getUltimosPromediosExcluyendoHoy() {
  const query = `
    SELECT * FROM promedios_diarios
    WHERE fecha < CURRENT_DATE
    ORDER BY fecha DESC
    LIMIT 10;
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function getPromedioDiarioPorFecha(fecha) {
  const query = `
    SELECT * FROM promedios_diarios
    WHERE fecha = $1;
  `;
  const result = await pool.query(query, [fecha]);
  return result.rows[0];
}

async function upsertPromedioDiario(fecha, pm25Promedio, pm10Promedio, tipo, confianza = null, source = 'calculated') {
    const { getEstadoPM25, getEstadoPM10 } = require('./utils');
    const pm25_estado = pm25Promedio !== null ? getEstadoPM25(pm25Promedio) : null;
    const pm10_estado = pm10Promedio !== null ? getEstadoPM10(pm10Promedio) : null;

    const query = `
        INSERT INTO promedios_diarios (fecha, pm25_promedio, pm10_promedio, tipo, confianza, pm25_estado, pm10_estado, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (fecha) DO UPDATE SET
            pm25_promedio = EXCLUDED.pm25_promedio,
            pm10_promedio = EXCLUDED.pm10_promedio,
            tipo = EXCLUDED.tipo,
            confianza = EXCLUDED.confianza,
            pm25_estado = EXCLUDED.pm25_estado,
            pm10_estado = EXCLUDED.pm10_estado,
            source = EXCLUDED.source,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *;
    `;

    const values = [fecha, pm25Promedio, pm10Promedio, tipo, confianza, pm25_estado, pm10_estado, source];
    // console.log('Upserting promedio diario:', values);
    try {
        const result = await pool.query(query, values);
        // console.log('Upserted promedio diario:', result.rows[0]);
        return result.rows[0];
    } catch (error) {
        console.error('Error in upsertPromedioDiario:', error);
        console.error('Query:', query);
        console.error('Values:', values);
        throw error;
    }
}

/**
 * Inserta o actualiza un promedio diario de PM2.5 obtenido de WAQI.
 * @param {string} fechaString - La fecha en formato 'YYYY-MM-DD'.
 * @param {number} pm25Average - El valor promedio de PM2.5.
 * @returns {Promise<object>} El registro insertado o actualizado.
 */
async function upsertWaqiDailyAverage(fechaString, pm25Average) {
    // PM10 no viene de esta fuente, así que se pasa null.
    // La lógica de upsertPromedioDiario se encargará de actualizar pm10_promedio y pm10_estado a null.
    return upsertPromedioDiario(fechaString, pm25Average, null, 'historico', null, 'WAQI');
}

/**
 * Inserta múltiples mediciones horarias en la tabla mediciones_api.
 * Asume que los datos vienen de WAQI y pueden contener pm25 y pm10.
 * @param {Array<object>} hourlyReadings - Array de objetos { time: string (ISO UTC), pm25: number|null, pm10: number|null }.
 * @returns {Promise<void>} 
 */
async function batchInsertHourlyWaqiReadings(hourlyReadings) {
    if (!hourlyReadings || hourlyReadings.length === 0) {
        console.log('No hourly readings to insert.');
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Usamos ON CONFLICT para evitar duplicados si alguna lectura horaria ya existe
        // Esto es importante si el script se ejecuta varias veces o si hay solapamiento de datos
        const query = `
            INSERT INTO mediciones_api (fecha, pm25, pm10)
            VALUES ($1, $2, $3)
            ON CONFLICT (fecha) DO UPDATE SET
                pm25 = GREATEST(EXCLUDED.pm25, mediciones_api.pm25), -- Conserva el valor existente si el nuevo es null
                pm10 = GREATEST(EXCLUDED.pm10, mediciones_api.pm10)  -- Conserva el valor existente si el nuevo es null
            WHERE mediciones_api.pm25 IS NULL OR mediciones_api.pm10 IS NULL; -- Solo actualiza si había datos nulos
        `;
        // Una estrategia alternativa más simple sería ON CONFLICT (fecha) DO NOTHING o 
        // ON CONFLICT (fecha) DO UPDATE SET pm25 = EXCLUDED.pm25, pm10 = EXCLUDED.pm10;
        // La actual intenta ser un poco más inteligente al fusionar datos, pero puede ser compleja.
        // Por simplicidad y robustez, un DO NOTHING o un DO UPDATE completo podrían ser preferibles.
        // Vamos a optar por un DO UPDATE completo para asegurar que los datos de WAQI (más recientes) prevalezcan.
        
        const upsertQuery = `
            INSERT INTO mediciones_api (fecha, pm25, pm10)
            VALUES ($1, $2, $3)
            ON CONFLICT (fecha) DO UPDATE SET
                pm25 = EXCLUDED.pm25,
                pm10 = EXCLUDED.pm10,
                updated_at = CURRENT_TIMESTAMP; -- Asegurarse que updated_at se actualiza
        `;

        for (const reading of hourlyReadings) {
            // WAQI times are already converted to UTC string in waqiDataFetcher.js
            await client.query(upsertQuery, [reading.time, reading.pm25, reading.pm10]);
        }
        await client.query('COMMIT');
        console.log(`Batch inserted/updated ${hourlyReadings.length} hourly readings into mediciones_api.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in batchInsertHourlyWaqiReadings:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Obtiene todas las lecturas horarias (pm25, pm10) para una fecha específica.
 * @param {string} fechaStr - Fecha en formato 'YYYY-MM-DD'.
 * @returns {Promise<Array<{fecha: Date, pm25: number | null, pm10: number | null}>>}
 */
async function getHourlyReadingsForDate(fechaStr) {
    const query = `
        SELECT fecha, pm25, pm10
        FROM mediciones_api
        WHERE DATE(fecha AT TIME ZONE $1) = $2
        ORDER BY fecha ASC;
    `;
    // MAIN_TIMEZONE debería ser accesible aquí, o pasar como argumento.
    // Por ahora, asumimos que es 'Europe/Madrid' como en otros lugares.
    // Considerar definir MAIN_TIMEZONE en un lugar centralizado (e.g. utils.js o config.js)
    const timezone = 'Europe/Madrid'; 
    try {
        const result = await pool.query(query, [timezone, fechaStr]);
        return result.rows;
    } catch (error) {
        console.error(`Error fetching hourly readings for date ${fechaStr}:`, error);
        throw error;
    }
}

/**
 * Inserta o actualiza múltiples predicciones en la tabla promedios_diarios.
 * @param {Array<object>} predicciones - Array de objetos de predicción.
 *        Cada objeto debe tener: { fecha: string, pm25Promedio: number, tipo: 'prediccion', confianza: number, source: string }
 * @param {string} contaminante - El tipo de contaminante ('pm25' o 'pm10'). Actualmente enfocado en pm25.
 */
async function insertarPredicciones(predicciones, contaminante = 'pm25') {
    if (!predicciones || predicciones.length === 0) {
        console.log('No hay predicciones para insertar.');
        return;
    }
    // console.log(`Insertando ${predicciones.length} predicciones para ${contaminante}...`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const pred of predicciones) {
            if (contaminante === 'pm25') {
                // Para PM2.5, pm10Promedio es null
                await upsertPromedioDiario(
                    pred.fecha, 
                    pred.pm25Promedio, 
                    null, // pm10Promedio
                    'prediccion', 
                    pred.confianza,
                    pred.source || 'model_default' // Asegurar que source tiene un valor
                );
            } else if (contaminante === 'pm10') {
                // Para PM10, pm25Promedio es null (si el modelo solo predice un contaminante a la vez)
                 await upsertPromedioDiario(
                    pred.fecha, 
                    null, // pm25Promedio
                    pred.pm10Promedio, // Asumiendo que el objeto pred tiene pm10Promedio si contaminante es 'pm10'
                    'prediccion', 
                    pred.confianza,
                    pred.source || 'model_default'
                );
            } else {
                console.warn(`Contaminante no soportado para inserción de predicciones: ${contaminante}`);
            }
        }
        await client.query('COMMIT');
        console.log(`✅ ${predicciones.length} predicciones para ${contaminante} insertadas/actualizadas.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error insertando predicciones:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Crear tabla de usuarios
async function createUsersTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'external'
      name VARCHAR(100),
      preferences JSONB,
      email_notifications_active BOOLEAN DEFAULT false,
      is_confirmed BOOLEAN DEFAULT false,
      confirmation_token TEXT,
      confirmation_token_expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await pool.query(createTableSQL);
  console.log('✅ Tabla users creada (si no existía)');

  // Asegurar que la columna email_notifications_active exista
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_active BOOLEAN DEFAULT false');
    console.log('✅ Columna email_notifications_active asegurada en tabla users.');
  } catch (err) {
    if (err.code === '42701') { // column already exists
      console.log('ℹ️ Columna email_notifications_active ya existía.');
    } else {
      console.error('Error asegurando columna email_notifications_active:', err);
    }
  }
  
  // Asegurar las nuevas columnas de confirmación de correo
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false');
    console.log('✅ Columna is_confirmed asegurada en tabla users.');
  } catch (err) { /* Silenciar error si ya existe */ }
  
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS confirmation_token TEXT');
    console.log('✅ Columna confirmation_token asegurada en tabla users.');
  } catch (err) { /* Silenciar error si ya existe */ }

  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS confirmation_token_expires_at TIMESTAMP WITH TIME ZONE');
    console.log('✅ Columna confirmation_token_expires_at asegurada en tabla users.');
  } catch (err) { /* Silenciar error si ya existe */ }

  // Trigger para updated_at
  const triggerFunctionSQL = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;
  await pool.query(triggerFunctionSQL);

  const triggerSQL = `
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `;
  await pool.query(triggerSQL);
}

// Crear tabla de métricas de predicciones
async function createPredictionMetricsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS prediction_metrics (
      id SERIAL PRIMARY KEY,
      fecha_prediccion DATE NOT NULL,
      fecha_real DATE NOT NULL,
      valor_predicho DECIMAL(5,2) NOT NULL,
      valor_real DECIMAL(5,2) NOT NULL,
      modelo_version VARCHAR(50) NOT NULL DEFAULT 'Modelo Predictivo 0.0',
      error_absoluto DECIMAL(5,2) GENERATED ALWAYS AS (ABS(valor_predicho - valor_real)) STORED,
      error_relativo DECIMAL(5,2) GENERATED ALWAYS AS (ABS(valor_predicho - valor_real) / NULLIF(valor_real, 0) * 100) STORED,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(fecha_prediccion, fecha_real, modelo_version)
    );
  `;
  
  await pool.query(createTableSQL);
  console.log('✅ Tabla prediction_metrics creada/actualizada correctamente');
}

// Crear tabla de notificaciones enviadas
async function createNotificationsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS notifications_sent (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL, -- 'daily_prediction', 'alert', 'welcome'
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      content TEXT,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending'))
    );
  `;
  
  await pool.query(createTableSQL);
  console.log('✅ Tabla notifications_sent creada/actualizada correctamente');
}

// Crear índices para las nuevas tablas
async function createUserIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);',
    'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);',
    'CREATE INDEX IF NOT EXISTS idx_users_email_notifications_active ON users(email_notifications_active);',
    'CREATE INDEX IF NOT EXISTS idx_users_confirmation_token ON users(confirmation_token);'
  ];
  
  for (const indexSQL of indexes) {
    await pool.query(indexSQL);
  }
  console.log('✅ Índices de usuario creados/actualizados');
}

// Crear nuevo usuario
async function createUser(email, passwordHash, role = 'external', name = null, confirmationToken = null, tokenExpiresAt = null) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, name, confirmation_token, confirmation_token_expires_at, is_confirmed)
     VALUES ($1, $2, $3, $4, $5, $6, false)
     RETURNING id, email, role, name, created_at, is_confirmed`,
    [email, passwordHash, role, name, confirmationToken, tokenExpiresAt]
  );
  return result.rows[0];
}

// Obtener usuario por email
async function getUserByEmail(email) {
  const result = await pool.query(`
    SELECT id, email, password_hash, role, name, email_verified, email_alerts, daily_predictions, last_login
    FROM users 
    WHERE email = $1
  `, [email]);
  
  return result.rows[0];
}

// Obtener usuario por ID
async function getUserById(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

// Obtener usuario por token de confirmación
async function getUserByConfirmationToken(token) {
  const result = await pool.query(
    'SELECT * FROM users WHERE confirmation_token = $1 AND confirmation_token_expires_at > NOW()', 
    [token]
  );
  return result.rows[0];
}

// Confirmar email de usuario
async function confirmUserEmail(userId) {
  const result = await pool.query(
    'UPDATE users SET is_confirmed = true, confirmation_token = NULL, confirmation_token_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, email, is_confirmed',
    [userId]
  );
  return result.rows[0];
}

// Actualizar preferencias de usuario
async function updateUserPreferences(userId, preferences) {
  const result = await pool.query(
    'UPDATE users SET preferences = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [preferences, userId]
  );
  return result.rows[0];
}

/**
 * Obtiene todos los usuarios que tienen las notificaciones por correo activadas.
 * @returns {Promise<Array<{id: number, email: string}>>}
 */
async function getUsersForDailyPredictions() {
  try {
    const result = await pool.query(`
      SELECT id, email 
      FROM users 
      WHERE email_notifications_active = true
    `);
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo usuarios para predicciones:', error);
    return [];
  }
}

/**
 * Asegura que un usuario exista con el email dado y activa sus notificaciones.
 * Si el usuario no existe, lo crea con una contraseña placeholder (solo para pruebas).
 * ¡NO USAR EN PRODUCCIÓN PARA CREAR USUARIOS REALES SIN UNA GESTIÓN DE CONTRASEÑA ADECUADA!
 * @param {string} email - Email del usuario.
 * @param {string} [name] - Nombre del usuario.
 * @returns {Promise<void>}
 */
async function ensureTestUserForNotifications(email, name = 'Usuario de Prueba Notificaciones') {
  try {
    let user = await getUserByEmail(email);
    if (user) {
      if (!user.email_notifications_active) {
        await pool.query(
          'UPDATE users SET email_notifications_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [user.id]
        );
        console.log(`📬 Notificaciones activadas para usuario existente: ${email}`);
      } else {
        console.log(`👍 Usuario ${email} ya existe y tiene notificaciones activas.`);
      }
    } else {
      // Contraseña placeholder - ¡NO HACER ESTO EN PRODUCCIÓN!
      // En un entorno real, se debería invitar al usuario o tener un flujo de registro.
      const placeholderPasswordHash = 'test_password_hash_ignore'; 
      const newUser = await createUser(email, placeholderPasswordHash, 'user', name);
      await pool.query(
        'UPDATE users SET email_notifications_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [newUser.id]
      );
      console.log(`👤 Creado usuario de prueba ${email} con notificaciones activas.`);
    }
  } catch (error) {
    console.error(`❌ Error asegurando usuario de prueba ${email}:`, error);
  }
}

// Función para registrar métricas de predicción
async function insertPredictionMetric(fechaPrediccion, fechaReal, valorPredicho, valorReal, modeloVersion = 'Modelo Predictivo 0.0') {
  const result = await pool.query(`
    INSERT INTO prediction_metrics (fecha_prediccion, fecha_real, valor_predicho, valor_real, modelo_version)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (fecha_prediccion, fecha_real, modelo_version) 
    DO UPDATE SET 
      valor_predicho = EXCLUDED.valor_predicho,
      valor_real = EXCLUDED.valor_real
    RETURNING *
  `, [fechaPrediccion, fechaReal, valorPredicho, valorReal, modeloVersion]);
  
  return result.rows[0];
}

// Función para obtener métricas de predicciones
async function getPredictionMetrics(limit = 30) {
  const result = await pool.query(`
    SELECT 
      fecha_prediccion,
      fecha_real,
      valor_predicho,
      valor_real,
      modelo_version,
      error_absoluto,
      error_relativo,
      created_at
    FROM prediction_metrics
    ORDER BY fecha_real DESC
    LIMIT $1
  `, [limit]);
  
  return result.rows;
}

// Función para obtener estadísticas de precisión del modelo
async function getModelAccuracyStats(modeloVersion = 'Modelo Predictivo 0.0') {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_predicciones,
      ROUND(AVG(error_absoluto), 2) as error_absoluto_promedio,
      ROUND(AVG(error_relativo), 2) as error_relativo_promedio,
      ROUND(MIN(error_absoluto), 2) as mejor_prediccion,
      ROUND(MAX(error_absoluto), 2) as peor_prediccion,
      ROUND(STDDEV(error_absoluto), 2) as desviacion_estandar
    FROM prediction_metrics
    WHERE modelo_version = $1
  `, [modeloVersion]);
  
  return result.rows[0];
}

// Función para registrar notificación enviada
async function logNotificationSent(userId, type, email, subject, content, status = 'sent') {
  const result = await pool.query(`
    INSERT INTO notifications_sent (user_id, type, email, subject, content, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `, [userId, type, email, subject, content, status]);
  
  return result.rows[0];
}

// Función para obtener promedios diarios anteriores
async function getPromediosDiariosAnteriores(fechaReferencia, diasAtras, contaminante = 'pm25') {
  const result = await pool.query(`
    SELECT fecha, promedio_pm10 as pm25_promedio, tipo, confianza, source
    FROM promedios_diarios
    WHERE fecha < $1
    ORDER BY fecha DESC
    LIMIT $2
  `, [fechaReferencia, diasAtras]);
  
  return result.rows;
}

// Exportar la conexión y las funciones
module.exports = {
    pool,
    createMedicionesApiTable,
    testConnection,
    createTables,
    createIndexes,
    getUltimosPromediosExcluyendoHoy,
    getPromedioDiarioPorFecha,
    upsertPromedioDiario,
    upsertWaqiDailyAverage,
    batchInsertHourlyWaqiReadings,
    getHourlyReadingsForDate,
    insertarPredicciones,
    // Nuevas funciones de usuarios
    createUser,
    getUserByEmail,
    getUserById,
    updateUserPreferences,
    getUsersForDailyPredictions,
    ensureTestUserForNotifications,
    insertPredictionMetric,
    getPredictionMetrics,
    getModelAccuracyStats,
    logNotificationSent,
    getPromediosDiariosAnteriores,
    getUserByConfirmationToken,
    confirmUserEmail
};

// Solo ejecutar la inicialización si no estamos en un script de actualización
// y si no hay otra inicialización en curso
if (!process.argv.includes('update_aqicn.js') && !isInitializing && !isInitialized) {
    // Usar setTimeout para evitar problemas de concurrencia al importar
    setTimeout(() => {
        if (!isInitializing && !isInitialized) {
            testConnection()
                .then(success => {
                    if (success) {
                        return createMedicionesApiTable();
                    }
                })
                .catch(err => {
                    if (err.code === 'XX000' && err.message.includes('tuple concurrently updated')) {
                        console.log('⚠️ Conflicto de concurrencia en inicialización automática. Continuando...');
                    } else {
                        console.error('❌ Error en la inicialización automática de la base de datos:', err);
                    }
                });
        }
    }, 100); // Pequeño delay para evitar condiciones de carrera
}