const { Client } = require('pg');

const client = new Client({
  user: 'sergio', // Reemplaza con tu usuario de PostgreSQL
  host: 'localhost',
  database: 'air_gijon', // Reemplaza con el nombre de tu base de datos
  password: 'air', // Reemplaza con tu contraseña
  port: 5432,
});

async function testConnection() {
  try {
    await client.connect();
    console.log("✅ Conexión exitosa a PostgreSQL");
  } catch (error) {
    console.error("❌ Error de conexión:", error);
  } finally {
    await client.end();
  }
}

testConnection();