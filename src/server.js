// Archivo de redirección temporal para Render.com
// Este archivo redirige a la nueva ubicación del server principal tras reorganización
// FIX: Corrigiendo rutas de importación

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool } = require('./database/db.js');
const { ensureAdminUser } = require('./auth/auth.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Rutas de la API
const apiRoutes = require('./routes/index.js');
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