import { useEffect, useState } from 'react';

const API_URL = import.meta.env.PROD
  ? "https://air-gijon.onrender.com/api/air/constitucion/evolucion"
  : "/api/air/constitucion/evolucion";

function EvolutionCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API_URL)
      .then(res => {
        if (!res.ok) throw new Error('Error al obtener datos');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    
    return date.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short'
    });
  };

  const getQualityColor = (pm10) => {
    if (pm10 <= 40) return '#10B981'; // Verde - Buena
    if (pm10 <= 50) return '#F59E0B'; // Amarillo - Moderada
    if (pm10 <= 100) return '#EF4444'; // Rojo - Regular
    return '#7C2D12'; // Marrón - Mala
  };

  const getMaxValue = () => {
    if (!data?.datos) return 60;
    const maxPm10 = Math.max(...data.datos.map(d => d.promedio_pm10));
    return Math.max(60, Math.ceil(maxPm10 / 10) * 10);
  };

  const getYPosition = (value, maxValue) => {
    return 180 - (value / maxValue) * 160; // 180 es la altura del gráfico, 160 el área útil
  };

  if (loading) {
    return (
      <div className="evolution-card">
        <div className="card-header">
          <h3>📈 Evolución y Predicción</h3>
          <p>Últimos 5 días + predicción</p>
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
          <h3>📈 Evolución y Predicción</h3>
          <p>Últimos 5 días + predicción</p>
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
  const points = data.datos.map((item, index) => ({
    x: 50 + (index * 80), // Espaciado de 80px entre puntos
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
        <h3>📈 Evolución y Predicción PM10</h3>
        <p>Últimos {data.historicos} días + {data.predicciones} predicciones</p>
      </div>

      <div className="chart-container">
        <svg viewBox="0 0 450 220" className="evolution-chart">
          {/* Grid lines */}
          {[0, 20, 40, 60].map(value => (
            <g key={value}>
              <line
                x1="30"
                y1={getYPosition(value, maxValue)}
                x2="420"
                y2={getYPosition(value, maxValue)}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray={value === 40 ? "5,5" : "none"}
              />
              <text
                x="25"
                y={getYPosition(value, maxValue) + 4}
                fontSize="10"
                fill="#6B7280"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          ))}

          {/* Línea de referencia PM10 = 40 (límite buena calidad) */}
          <line
            x1="30"
            y1={getYPosition(40, maxValue)}
            x2="420"
            y2={getYPosition(40, maxValue)}
            stroke="#10B981"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.7"
          />

          {/* Línea principal */}
          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
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
                r={point.tipo === 'prediccion' ? "6" : "4"}
                fill={point.tipo === 'prediccion' ? "#F59E0B" : getQualityColor(point.promedio_pm10)}
                stroke="white"
                strokeWidth="2"
                className="data-point"
              />
              
              {/* Indicador de predicción */}
              {point.tipo === 'prediccion' && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                  opacity="0.6"
                />
              )}

              {/* Etiquetas de fecha */}
              <text
                x={point.x}
                y="210"
                fontSize="10"
                fill="#6B7280"
                textAnchor="middle"
                className="date-label"
              >
                {formatDate(point.fecha)}
              </text>

              {/* Valores PM10 */}
              <text
                x={point.x}
                y={point.y - 12}
                fontSize="11"
                fill="#1F2937"
                textAnchor="middle"
                fontWeight="600"
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
          <div className="legend-line good-limit"></div>
          <span>Límite calidad buena (40 µg/m³)</span>
        </div>
      </div>

      {/* Información adicional */}
      <div className="prediction-info">
        {data.datos.filter(d => d.tipo === 'prediccion').map(pred => (
          <div key={pred.fecha} className="prediction-item">
            <span className="prediction-date">{formatDate(pred.fecha)}</span>
            <span className="prediction-value">{Math.round(pred.promedio_pm10)} µg/m³</span>
            <span className="prediction-confidence">
              {pred.confianza ? `${Math.round(pred.confianza * 100)}% confianza` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EvolutionCard; 