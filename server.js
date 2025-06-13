// Archivo de redirección para Render.com
// Este archivo redirige a la nueva ubicación del server principal.
// Render ejecuta `node server.js` y este archivo carga el servidor real desde /src.

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require('./database/db');
const { ensureAdminUser } = require('./auth/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Sirve los archivos estáticos de React desde la carpeta frontend/dist
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Rutas API
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// Para cualquier otra ruta, sirve el index.html de React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist', 'index.html'));
});

// Iniciar servidor y asegurar usuario admin
const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('🐘 Conexión con PostgreSQL exitosa');
    await ensureAdminUser();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app; 