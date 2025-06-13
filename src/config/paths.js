const path = require('path');

// El directorio raíz del proyecto es el que contiene la carpeta 'src'
const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  projectRoot,
  routes: path.join(projectRoot, 'routes'),
  // Puedes añadir otras rutas importantes aquí si es necesario
  // Por ejemplo:
  // public: path.join(projectRoot, 'public'),
  // database: path.join(projectRoot, 'database')
};
