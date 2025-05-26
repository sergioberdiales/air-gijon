function AirQualityCard({ data }) {
  const estadoConfig = {
    Buena: { class: 'buena', icon: '🌿', color: '#22C55E', description: 'Calidad del aire excelente' },
    Moderada: { class: 'moderada', icon: '🟡', color: '#F59E0B', description: 'Calidad del aire aceptable' },
    Regular: { class: 'regular', icon: '🟠', color: '#F97316', description: 'Calidad del aire regular' },
    Mala: { class: 'mala', icon: '🔴', color: '#EF4444', description: 'Calidad del aire deficiente' }
  };

  const config = estadoConfig[data.estado] || { class: '', icon: '❓', color: '#6B7280', description: 'Estado desconocido' };
  const fecha = new Date(data.fecha);

  // Calcular el porcentaje para la barra de progreso
  const getProgressPercentage = (value) => {
    if (value <= 25) return (value / 25) * 25;
    if (value <= 50) return 25 + ((value - 25) / 25) * 25;
    if (value <= 75) return 50 + ((value - 50) / 25) * 25;
    return 75 + Math.min(((value - 75) / 25) * 25, 25);
  };

  return (
    <div className="air-quality-card">
      <div className="card-header">
        <div className="station-info">
          <div className="station-icon">🏢</div>
          <div>
            <h2>Estación Av. Constitución</h2>
            <p className="station-name">Gijón, Asturias</p>
          </div>
        </div>
        <div className="timestamp">
          <span className="time-icon">🕐</span>
          <span>{fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="pm10-section">
        <div className="pm10-label">PM10</div>
        <div className="pm10-value">
          <span className="value">{data.pm10}</span>
          <span className="unit">µg/m³</span>
        </div>
        
        <div className="quality-indicator">
          <div className="quality-bar">
            <div 
              className="quality-fill" 
              style={{ 
                width: `${getProgressPercentage(data.pm10)}%`
              }}
            ></div>
          </div>
          <div className="quality-markers">
            <div className="marker">
              <span>0</span>
            </div>
            <div className="marker">
              <span>50</span>
            </div>
            <div className="marker">
              <span>100+</span>
            </div>
          </div>
        </div>

        <div className={`quality-status ${config.class}`}>
          <span className="status-icon">{config.icon}</span>
          <div className="status-content">
            <span className="status-text">{data.estado}</span>
            <span className="status-description">{config.description}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AirQualityCard;
