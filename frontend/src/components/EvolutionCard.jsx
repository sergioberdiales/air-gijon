import { useEffect, useState } from 'react';
import LineChartIcon from './icons/LineChartIcon';
import { config } from '../config'; // Importar config

// Usar API_BASE y API_ENDPOINTS de config
const API_URL_EVOLUTION = `${config.API_BASE}${config.API_ENDPOINTS.EVOLUTION}`;

function EvolutionCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API_URL_EVOLUTION)
      .then(res => {
        if (!res.ok) throw new Error('Error al obtener datos');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr) => {
    // Las fechas vienen en UTC (22:00:00.000Z = medianoche en España UTC+2)
    const date = new Date(dateStr);
    
    // Convertir a fecha local española para mostrar
    const localDate = new Date(date.getTime() + (2 * 60 * 60 * 1000)); // UTC+2
    
    return localDate.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short'
    });
  };

  const getQualityColor = (pm25) => {
    if (pm25 <= 15) return 'var(--status-buena-color)'; // Verde - Buena
    if (pm25 <= 25) return 'var(--status-moderada-color)'; // Amarillo - Moderada
    if (pm25 <= 50) return 'var(--status-regular-color)'; // Naranja - Regular
    return 'var(--status-mala-color)'; // Rojo - Mala
  };

  const getMaxValue = () => {
    if (!data?.datos) return 30;
    const maxPm25 = Math.max(...data.datos.map(d => d.promedio_pm10)); // API devuelve promedio_pm10 pero contiene datos PM2.5
    return Math.max(30, Math.ceil(maxPm25 / 10) * 10);
  };

  const getYPosition = (value, maxValue) => {
    return 180 - (value / maxValue) * 160; // 180 es la altura del gráfico, 160 el área útil
  };

  // Detectar tamaño de pantalla para responsive design
  const [windowWidth, setWindowWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1200; // Valor por defecto para SSR
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Configuración responsive
  const getResponsiveConfig = () => {
    if (windowWidth <= 480) {
      return {
        pointSpacing: 50,     // Aumentado de 45 a 50px
        fontSize: 9,          // Texto más pequeño
        valueOffset: 30,      // Menos offset para valores
        svgPadding: 35,       // Padding ajustado
        dateRotation: -90,    // Rotación vertical completa
        dateYOffset: 8        // Offset extra para fechas rotadas
      };
    } else if (windowWidth <= 768) {
      return {
        pointSpacing: 60,     // Aumentado de 55 a 60px
        fontSize: 10,
        valueOffset: 32,
        svgPadding: 40,
        dateRotation: 0,
        dateYOffset: 0
      };
    } else {
      return {
        pointSpacing: 70,
        fontSize: 11,
        valueOffset: 35,
        svgPadding: 50,
        dateRotation: 0,
        dateYOffset: 0
      };
    }
  };

  if (loading) {
    return (
      <div className="evolution-card">
        <div className="card-header">
          <div className="station-info">
            <div className="station-icon">
              <LineChartIcon size={24} />
            </div>
            <div>
              <h3>Evolución y Predicción</h3>
              <p className="station-name">Últimos 5 días + predicción</p>
            </div>
          </div>
        </div>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Cargando datos de evolución...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.datos) {
    return (
      <div className="evolution-card">
        <div className="card-header">
          <div className="station-info">
            <div className="station-icon">
              <LineChartIcon size={24} />
            </div>
            <div>
              <h3>Evolución y Predicción</h3>
              <p className="station-name">Últimos 5 días + predicción</p>
            </div>
          </div>
        </div>
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h4>No hay datos disponibles</h4>
          <p>{error || 'No se pudieron cargar los datos de evolución'}</p>
        </div>
      </div>
    );
  }

  const maxValue = getMaxValue();
  const totalPoints = data.datos.length;
  const config = getResponsiveConfig();
  
  // Ancho dinámico más preciso - eliminar espacio vacío
  const svgWidth = (config.svgPadding * 2) + ((totalPoints - 1) * config.pointSpacing);
  
  const points = data.datos.map((item, index) => ({
    x: config.svgPadding + (index * config.pointSpacing),
    y: getYPosition(item.promedio_pm10, maxValue),
    ...item
  }));

  // Crear path para la línea
  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  return (
    <div className="evolution-card">
      <div className="card-header">
        <div className="station-info">
          <div className="station-icon">
            <LineChartIcon size={24} />
          </div>
          <div>
            <h3>Evolución y Predicción PM2.5</h3>
            <p className="station-name">Últimos {data.datos.filter(d => d.tipo === 'historico').length} días + {data.datos.filter(d => d.tipo === 'prediccion').length} predicciones</p>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <svg viewBox={`0 0 ${svgWidth} 220`} className="evolution-chart">
          {/* Grid lines */}
          {[0, 10, 15, 25, 50].map(value => (
            <g key={value}>
              <line
                x1={config.svgPadding - 20}
                y1={getYPosition(value, maxValue)}
                x2={svgWidth - config.svgPadding + 20}
                y2={getYPosition(value, maxValue)}
                stroke="var(--border-primary)"
                strokeWidth="1"
                strokeDasharray={value === 15 ? "5,5" : "none"}
              />
              <text
                x={config.svgPadding - 25}
                y={getYPosition(value, maxValue) + 4}
                fontSize={config.fontSize}
                fill="var(--text-secondary)"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          ))}

          {/* Línea de referencia PM2.5 = 15 (límite buena calidad) */}
          <line
            x1={config.svgPadding - 20}
            y1={getYPosition(15, maxValue)}
            x2={svgWidth - config.svgPadding + 20}
            y2={getYPosition(15, maxValue)}
            stroke="var(--status-buena-color)"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />

          {/* Línea principal */}
          <path
            d={pathData}
            fill="none"
            stroke="var(--primary-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Puntos de datos */}
          {points.map((point, index) => (
            <g key={index}>
              {/* Círculo del punto */}
              <circle
                cx={point.x}
                cy={point.y}
                r={point.tipo === 'prediccion' ? "7" : "5"}
                fill={point.tipo === 'prediccion' ? "var(--status-moderada-color)" : getQualityColor(point.promedio_pm10)}
                stroke={point.tipo === 'prediccion' ? "var(--status-moderada-color)" : "white"}
                strokeWidth="3"
                className="data-point"
              />
              
              {/* Indicador de predicción más visible */}
              {point.tipo === 'prediccion' && (
                <>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="11"
                    fill="none"
                    stroke="var(--status-moderada-color)"
                    strokeWidth="2"
                    strokeDasharray="4,2"
                    opacity="0.8"
                  />
                  {/* Icono de predicción */}
                  <text
                    x={point.x}
                    y={point.y - 20}
                    fontSize="12"
                    textAnchor="middle"
                    fill="var(--status-moderada-color)"
                  >
                    🔮
                  </text>
                </>
              )}

              {/* Etiquetas de fecha */}
              <text
                x={point.x}
                y={210 + (config.dateYOffset || 0)}
                fontSize={config.fontSize}
                fill="var(--text-secondary)"
                textAnchor="middle"
                className="date-label"
                fontWeight={point.tipo === 'prediccion' ? "600" : "normal"}
                transform={config.dateRotation !== 0 ? `rotate(${config.dateRotation} ${point.x} ${210 + (config.dateYOffset || 0)})` : ''}
              >
                {windowWidth <= 480 ? 
                  // En móvil: formato más corto y claro
                  formatDate(point.fecha).split(' ')[0] + ' ' + formatDate(point.fecha).split(' ')[1] : 
                  formatDate(point.fecha) // Completo en desktop
                }
              </text>

              {/* Valores PM2.5 */}
              <text
                x={point.x}
                y={point.y - (point.tipo === 'prediccion' ? config.valueOffset : 12)}
                fontSize={config.fontSize}
                fill={point.tipo === 'prediccion' ? "var(--status-moderada-color)" : "var(--text-primary)"}
                textAnchor="middle"
                fontWeight="700"
                className="value-label"
              >
                {Math.round(point.promedio_pm10)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="legend">
        <div className="legend-item">
          <div className="legend-dot historical"></div>
          <span>Datos históricos</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot prediction"></div>
          <span>Predicciones</span>
        </div>
        <div className="legend-item">
          <div className="legend-line reference"></div>
          <span>Límite calidad buena (15 μg/m³)</span>
        </div>
      </div>
    </div>
  );
}

export default EvolutionCard; 