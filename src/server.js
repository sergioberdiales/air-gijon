// Archivo de redirección temporal para Render.com
// Este archivo redirige a la nueva ubicación del server principal tras reorganización

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas de la API
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});

module.exports = app; 