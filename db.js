const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Función para crear la tabla de mediciones_api si no existe
async function createMedicionesApiTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mediciones_api (
                id SERIAL PRIMARY KEY,
                estacion_id INTEGER REFERENCES estaciones(id),
                fecha DATE,
                periodo INTEGER,
                so2 DECIMAL(10,2),
                no DECIMAL(10,2),
                no2 DECIMAL(10,2),
                co DECIMAL(10,2),
                pm10 DECIMAL(10,2),
                o3 DECIMAL(10,2),
                dd DECIMAL(10,2),
                vv DECIMAL(10,2),
                tmp DECIMAL(10,2),
                hr DECIMAL(10,2),
                prb DECIMAL(10,2),
                rs DECIMAL(10,2),
                ll DECIMAL(10,2),
                ben DECIMAL(10,2),
                tol DECIMAL(10,2),
                mxil DECIMAL(10,2),
                pm25 DECIMAL(10,2),
                record_timestamp TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_validated BOOLEAN DEFAULT FALSE,
                validation_notes TEXT,
                UNIQUE(estacion_id, fecha, periodo)
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

// Exportar la conexión y las funciones
module.exports = {
    pool,
    createMedicionesApiTable
};

// Crear la tabla al iniciar la aplicación
createMedicionesApiTable()
    .then(() => console.log('✅ Conexión a PostgreSQL exitosa'))
    .catch(err => console.error('❌ Error de conexión a PostgreSQL:', err));