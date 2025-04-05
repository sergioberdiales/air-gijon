const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DB_USER || 'sergio',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'air_gijon',
  password: process.env.DB_PASSWORD || 'air',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function queryData() {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Consulta para estaciones
    console.log("\n📊 Últimas 10 estaciones:");
    const estacionesResult = await client.query(
      'SELECT * FROM estaciones ORDER BY id DESC LIMIT 10'
    );
    console.table(estacionesResult.rows);

    // Consulta para parámetros
    console.log("\n📊 Últimos 10 parámetros:");
    const parametrosResult = await client.query(
      'SELECT * FROM parametros ORDER BY id DESC LIMIT 10'
    );
    console.table(parametrosResult.rows);

    // Consulta para mediciones
    console.log("\n📊 Últimas 10 mediciones:");
    const medicionesResult = await client.query(
      'SELECT * FROM mediciones ORDER BY id DESC LIMIT 10'
    );
    console.table(medicionesResult.rows);

  } catch (error) {
    console.error("❌ Error querying data:", error);
  } finally {
    try {
      await client.end();
      console.log("\n🔌 Connection closed properly");
    } catch (error) {
      console.error("Error closing connection:", error);
    }
  }
}

// Ejecutar la función principal
queryData(); 