const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

// Database configuration using environment variables
const client = new Client({
  user: process.env.DB_USER || 'sergio',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'air_gijon',
  password: process.env.DB_PASSWORD || 'air',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Función para crear las tablas si no existen
async function createTables() {
  try {
    // Tabla de estaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS estaciones (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255),
        direccion VARCHAR(255),
        poblacion VARCHAR(255),
        provincia VARCHAR(255),
        latitud DECIMAL(10,6),
        longitud DECIMAL(10,6)
      );
    `);

    // Tabla de parámetros
    await client.query(`
      CREATE TABLE IF NOT EXISTS parametros (
        id SERIAL PRIMARY KEY,
        parametro VARCHAR(10),
        descripcion VARCHAR(255),
        tag VARCHAR(10),
        unidad VARCHAR(20),
        UNIQUE(parametro, tag)
      );
    `);

    // Tabla de mediciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS mediciones (
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
        fuente_archivo VARCHAR(255)
      );
    `);
    console.log("✅ Tablas creadas correctamente");
  } catch (error) {
    console.error("❌ Error creando tablas:", error);
    throw error;
  }
}

// Función para insertar estaciones
async function insertEstaciones() {
  return new Promise((resolve, reject) => {
    const estaciones = [];
    fs.createReadStream(path.join(__dirname, 'air_data_csv/aire_estaciones.csv'))
      .pipe(csvParser())
      .on('data', (row) => {
        estaciones.push({
          id: parseInt(row.ID),
          titulo: row.Título,
          direccion: row.Dirección,
          poblacion: row.Población,
          provincia: row.Provincia,
          latitud: row.latitud === 'N/A' ? null : parseFloat(row.latitud),
          longitud: row.longitud === 'N/A' ? null : parseFloat(row.longitud)
        });
      })
      .on('end', async () => {
        try {
          for (const estacion of estaciones) {
            await client.query(
              'INSERT INTO estaciones (id, titulo, direccion, poblacion, provincia, latitud, longitud) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              [estacion.id, estacion.titulo, estacion.direccion, estacion.poblacion, estacion.provincia, estacion.latitud, estacion.longitud]
            );
          }
          console.log("✅ Estaciones insertadas correctamente");
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Función para insertar parámetros
async function insertParametros() {
  return new Promise((resolve, reject) => {
    const parametros = new Map(); // Usamos Map para evitar duplicados
    fs.createReadStream(path.join(__dirname, 'air_data_csv/aire_descripcion_parametros.csv'))
      .pipe(csvParser())
      .on('data', (row) => {
        const key = `${row.Parametro}-${row.TAG}`;
        if (!parametros.has(key)) {
          parametros.set(key, {
            parametro: row.Parametro,
            descripcion: row['Descripción Parámetro'],
            tag: row.TAG,
            unidad: row.Unidad
          });
        }
      })
      .on('end', async () => {
        try {
          for (const parametro of parametros.values()) {
            await client.query(
              'INSERT INTO parametros (parametro, descripcion, tag, unidad) VALUES ($1, $2, $3, $4) ON CONFLICT (parametro, tag) DO NOTHING',
              [parametro.parametro, parametro.descripcion, parametro.tag, parametro.unidad]
            );
          }
          console.log("✅ Parámetros insertados correctamente");
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Función para insertar mediciones
async function insertMediciones() {
  return new Promise((resolve, reject) => {
    const mediciones = [];
    fs.createReadStream(path.join(__dirname, 'air_data_csv/aire_mediciones_muestra.csv'))
      .pipe(csvParser())
      .on('data', (row) => {
        mediciones.push({
          estacion_id: parseInt(row.Estación),
          fecha: row.Fecha,
          periodo: parseInt(row.Periodo),
          so2: row.SO2 ? parseFloat(row.SO2) : null,
          no: row.NO ? parseFloat(row.NO) : null,
          no2: row.NO2 ? parseFloat(row.NO2) : null,
          co: row.CO ? parseFloat(row.CO) : null,
          pm10: row.PM10 ? parseFloat(row.PM10) : null,
          o3: row.O3 ? parseFloat(row.O3) : null,
          dd: row.dd ? parseFloat(row.dd) : null,
          vv: row.vv ? parseFloat(row.vv) : null,
          tmp: row.TMP ? parseFloat(row.TMP) : null,
          hr: row.HR ? parseFloat(row.HR) : null,
          prb: row.PRB ? parseFloat(row.PRB) : null,
          rs: row.RS ? parseFloat(row.RS) : null,
          ll: row.LL ? parseFloat(row.LL) : null,
          ben: row.BEN ? parseFloat(row.BEN) : null,
          tol: row.TOL ? parseFloat(row.TOL) : null,
          mxil: row.MXIL ? parseFloat(row.MXIL) : null,
          pm25: row.PM25 ? parseFloat(row.PM25) : null,
          fuente_archivo: row.fuente_archivo
        });
      })
      .on('end', async () => {
        try {
          for (const medicion of mediciones) {
            await client.query(
              `INSERT INTO mediciones (
                estacion_id, fecha, periodo, so2, no, no2, co, pm10, o3, dd, vv, tmp, hr, prb, rs, ll, ben, tol, mxil, pm25, fuente_archivo
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
              )`,
              [
                medicion.estacion_id, medicion.fecha, medicion.periodo,
                medicion.so2, medicion.no, medicion.no2, medicion.co,
                medicion.pm10, medicion.o3, medicion.dd, medicion.vv,
                medicion.tmp, medicion.hr, medicion.prb, medicion.rs,
                medicion.ll, medicion.ben, medicion.tol, medicion.mxil,
                medicion.pm25, medicion.fuente_archivo
              ]
            );
          }
          console.log("✅ Mediciones insertadas correctamente");
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function insertData() {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Adding transaction support
    await client.query('BEGIN');
    
    try {
      await createTables();
      await insertEstaciones();
      await insertParametros();
      await insertMediciones();
      
      await client.query('COMMIT');
      console.log("🚀 Data inserted successfully!");
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("❌ Error inserting data:", error);
  } finally {
    try {
      await client.end();
      console.log("🔌 Connection closed properly");
    } catch (error) {
      console.error("Error closing connection:", error);
    }
  }
}

// Ejecutar la función principal
insertData();