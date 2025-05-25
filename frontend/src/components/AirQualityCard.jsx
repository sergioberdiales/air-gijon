function AirQualityCard({ data }) {
  const estadoConfig = {
    Buena: { class: 'buena', icon: '✅', color: '#10B981' },
    Moderada: { class: 'moderada', icon: '⚠️', color: '#F59E0B' },
    Regular: { class: 'regular', icon: '🟠', color: '#EF4444' },
    Mala: { class: 'mala', icon: '❌', color: '#DC2626' }
  };

  const config = estadoConfig[data.estado] || { class: '', icon: '❓', color: '#6B7280' };
  const fecha = new Date(data.fecha);

  return (
    <div className="air-quality-card">
      <div className="card-header">
        <div className="station-info">
          <span className="station-icon">🌡️</span>
          <div>
            <h2>Calidad del aire</h2>
            <p className="station-name">Estación Av. Constitución</p>
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
            <div className="quality-fill" style={{ width: `${Math.min((data.pm10 / 100) * 100, 100)}%`, backgroundColor: config.color }}></div>
            <div className="quality-markers">
              <span className="marker" style={{ left: '0%' }}>0</span>
              <span className="marker" style={{ left: '50%' }}>50</span>
              <span className="marker" style={{ left: '100%' }}>100+</span>
            </div>
          </div>
        </div>

        <div className={`quality-status ${config.class}`}>
          <span className="status-icon">{config.icon}</span>
          <span className="status-text">{data.estado}</span>
        </div>
      </div>
    </div>
  );
}

export default AirQualityCard;
