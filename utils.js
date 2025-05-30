// Configuración de estaciones de calidad del aire
const estaciones = {
  constitucion: {
    id: '6699',
    nombre: 'Avenida Constitución',
    ubicacion: 'Gijón - Asturias'
  }
};

/**
 * Determina el estado de calidad del aire basado en PM2.5
 * Según directrices de la OMS y estándares europeos
 * @param {number} pm25 - Valor de PM2.5 en µg/m³
 * @returns {string} Estado de calidad del aire
 */
function getEstadoPM25(pm25) {
  if (pm25 === null || pm25 === undefined || typeof pm25 !== 'number') {
    return 'Sin datos';
  }
  
  if (pm25 <= 15) return 'Buena';
  if (pm25 <= 25) return 'Moderada';
  if (pm25 <= 50) return 'Regular';
  return 'Mala';
}

/**
 * Determina el estado de calidad del aire basado en PM10
 * Según directrices de la OMS y estándares europeos
 * @param {number} pm10 - Valor de PM10 en µg/m³
 * @returns {string} Estado de calidad del aire
 */
function getEstadoPM10(pm10) {
  if (pm10 === null || pm10 === undefined || typeof pm10 !== 'number') {
    return 'Sin datos';
  }
  
  if (pm10 <= 40) return 'Buena';
  if (pm10 <= 50) return 'Moderada';
  if (pm10 <= 100) return 'Regular';
  return 'Mala';
}

/**
 * Obtiene información de color para representar visualmente el estado del aire
 * @param {string} estado - Estado de calidad del aire
 * @returns {object} Objeto con código de color y descripción
 */
function getColorEstado(estado) {
  const colores = {
    'Buena': { color: '#4CAF50', descripcion: 'Verde - Aire limpio' },
    'Moderada': { color: '#FFC107', descripcion: 'Amarillo - Calidad moderada' },
    'Regular': { color: '#FF9800', descripcion: 'Naranja - Calidad regular' },
    'Mala': { color: '#F44336', descripcion: 'Rojo - Calidad mala' },
    'Sin datos': { color: '#9E9E9E', descripcion: 'Gris - Sin información' }
  };
  
  return colores[estado] || colores['Sin datos'];
}

/**
 * Convierte un valor numérico a una descripción más detallada
 * @param {number} valor - Valor de contaminante
 * @param {string} tipo - Tipo de contaminante ('pm25' o 'pm10')
 * @returns {object} Objeto con valor, estado y recomendaciones
 */
function getAnalisisCompleto(valor, tipo = 'pm25') {
  const getEstado = tipo === 'pm25' ? getEstadoPM25 : getEstadoPM10;
  const estado = getEstado(valor);
  const color = getColorEstado(estado);
  
  const recomendaciones = {
    'Buena': 'Condiciones ideales para actividades al aire libre.',
    'Moderada': 'Calidad aceptable. Personas especialmente sensibles podrían experimentar síntomas menores.',
    'Regular': 'Grupos sensibles pueden experimentar efectos en la salud. Se recomienda reducir actividades prolongadas al aire libre.',
    'Mala': 'Toda la población puede experimentar efectos en la salud. Se recomienda evitar actividades al aire libre.'
  };
  
  return {
    valor: valor,
    estado: estado,
    color: color.color,
    descripcion: color.descripcion,
    recomendacion: recomendaciones[estado] || 'Consulte con autoridades locales.'
  };
}

module.exports = {
  estaciones,
  getEstadoPM25,
  getEstadoPM10,
  getColorEstado,
  getAnalisisCompleto
}; 