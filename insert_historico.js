const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

const client = new Client({
  user: process.env.DB_USER || 'sergio',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'air_gijon',
  password: process.env.DB_PASSWORD || 'air',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function insertHistorico() {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Iniciar transacción
    await client.query('BEGIN');

    try {
      // Limpiar la tabla de mediciones
      console.log("🧹 Limpiando tabla de mediciones...");
      await client.query('TRUNCATE TABLE mediciones');
      console.log("✅ Tabla de mediciones limpiada");

      // Contador para mostrar progreso
      let contador = 0;
      const batchSize = 500; // Reducir el tamaño del lote
      let batch = [];

      // Función para insertar un lote de registros
      const insertBatch = async (batch) => {
        if (batch.length === 0) return;
        
        const values = batch.map((_, i) => {
          const offset = i * 21; // 21 parámetros por registro
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21})`;
        }).join(',');

        const query = `
          INSERT INTO mediciones (
            estacion_id, fecha, periodo, so2, no, no2, co, pm10, o3, dd, vv, tmp, hr, prb, rs, ll, ben, tol, mxil, pm25, fuente_archivo
          ) VALUES ${values}
        `;

        const params = batch.flat();
        await client.query(query, params);
      };

      // Procesar el archivo CSV
      console.log("📥 Procesando archivo histórico...");
      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(path.join(__dirname, 'air_data_csv/aire_todos_los_anios.csv'))
          .pipe(csvParser());

        stream.on('data', async (row) => {
          const medicion = {
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
          };

          batch.push([
            medicion.estacion_id, medicion.fecha, medicion.periodo,
            medicion.so2, medicion.no, medicion.no2, medicion.co,
            medicion.pm10, medicion.o3, medicion.dd, medicion.vv,
            medicion.tmp, medicion.hr, medicion.prb, medicion.rs,
            medicion.ll, medicion.ben, medicion.tol, medicion.mxil,
            medicion.pm25, medicion.fuente_archivo
          ]);

          contador++;
          if (contador % 10000 === 0) {
            console.log(`📊 Procesados ${contador} registros...`);
          }

          if (batch.length >= batchSize) {
            stream.pause(); // Pausar el stream mientras insertamos
            await insertBatch(batch);
            batch = [];
            stream.resume(); // Reanudar el stream
          }
        });

        stream.on('end', async () => {
          // Insertar el último lote si queda alguno
          if (batch.length > 0) {
            await insertBatch(batch);
          }
          console.log(`✅ Procesamiento completado. Total de registros: ${contador}`);
          resolve();
        });

        stream.on('error', reject);
      });

      await client.query('COMMIT');
      console.log("🚀 Datos históricos insertados correctamente!");
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("❌ Error insertando datos históricos:", error);
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
insertHistorico(); 