const { Pool } = require('pg');

// Cargar variables de entorno solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false
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
  try {
    // Tabla mediciones_api
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mediciones_api (
        id SERIAL PRIMARY KEY,
        estacion_id VARCHAR(50) NOT NULL,
        fecha TIMESTAMP WITH TIME ZONE NOT NULL,
        parametro VARCHAR(50) NOT NULL,
        valor DECIMAL(10,2),
        aqi INTEGER,
        is_validated BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(estacion_id, fecha, parametro)
      )
    `);

    // Trigger para actualizar updated_at automáticamente
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_mediciones_api_updated_at ON mediciones_api;
      
      CREATE TRIGGER update_mediciones_api_updated_at
          BEFORE UPDATE ON mediciones_api
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);

    // Nueva tabla para promedios diarios y predicciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS promedios_diarios (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL UNIQUE,
        promedio_pm10 DECIMAL(10,2) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('historico', 'prediccion')),
        algoritmo VARCHAR(50), -- 'ponderado_semanal' para predicciones
        confianza DECIMAL(3,2), -- nivel de confianza 0-1
        datos_utilizados INTEGER, -- cuántas mediciones se usaron para el promedio
        detalles JSONB, -- información adicional sobre el cálculo
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabla mediciones_api creada/actualizada correctamente');
    console.log('✅ Tabla promedios_diarios creada/actualizada correctamente');
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    throw error;
  }
}

async function createIndexes() {
  try {
    // Índices para mediciones_api
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mediciones_api_estacion_fecha 
      ON mediciones_api(estacion_id, fecha DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mediciones_api_parametro_fecha 
      ON mediciones_api(parametro, fecha DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mediciones_api_fecha 
      ON mediciones_api(fecha DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mediciones_api_created_at 
      ON mediciones_api(created_at)
    `);

    // Índices para promedios_diarios
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_promedios_fecha 
      ON promedios_diarios(fecha DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_promedios_tipo 
      ON promedios_diarios(tipo)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_promedios_tipo_fecha 
      ON promedios_diarios(tipo, fecha DESC)
    `);

    console.log('✅ Índices para consultas históricas creados');
    console.log('✅ Índices para promedios diarios creados');
  } catch (error) {
    console.error('❌ Error creando índices:', error);
    throw error;
  }
}

// Función legacy para compatibilidad
async function createMedicionesApiTable() {
  await createTables();
  await createIndexes();
}

// Exportar la conexión y las funciones
module.exports = {
    pool,
    createMedicionesApiTable,
    testConnection,
    createTables,
    createIndexes
};

// Solo ejecutar la inicialización si no estamos en un script de actualización
if (!process.argv.includes('update_aqicn.js')) {
    testConnection()
        .then(success => {
            if (success) {
                return createMedicionesApiTable();
            }
        })
        .catch(err => console.error('❌ Error en la inicialización de la base de datos:', err));
}