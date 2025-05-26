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

// Función para crear la tabla de mediciones_api si no existe
async function createMedicionesApiTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mediciones_api (
                id SERIAL PRIMARY KEY,
                estacion_id VARCHAR(50),
                fecha TIMESTAMP WITH TIME ZONE,
                parametro VARCHAR(50),
                valor DECIMAL(10,2),
                aqi INTEGER,
                is_validated BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Trigger para actualizar updated_at automáticamente
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
        console.log('✅ Tabla mediciones_api creada/actualizada correctamente');
    } catch (error) {
        console.error('❌ Error creando tabla mediciones_api:', error);
        throw error;
    }
}

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

// Exportar la conexión y las funciones
module.exports = {
    pool,
    createMedicionesApiTable,
    testConnection
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