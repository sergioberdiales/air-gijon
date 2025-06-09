import React from 'react';
// import './AirQualityCard.css'; // Esta línea se elimina
import LeafIcon from './icons/LeafIcon';
import ShieldAlertIcon from './icons/ShieldAlertIcon';
import AlertOctagonIcon from './icons/AlertOctagonIcon';
import SkullIcon from './icons/SkullIcon';
import HelpCircleIcon from './icons/HelpCircleIcon'; // Asumo que este es para el estado desconocido
import Building2Icon from './icons/Building2Icon'; // Nuevo
import ClockIcon from './icons/ClockIcon'; // Nuevo

function AirQualityCard({ data }) {
  // Configuración original de los estados, adaptada para usar los nuevos iconos
  const estadoConfig = {
    Buena: { class: 'buena', icon: <LeafIcon size={24} />, color: 'var(--status-buena-color)', description: 'Calidad del aire excelente' },
    Moderada: { class: 'moderada', icon: <ShieldAlertIcon size={24} />, color: 'var(--status-moderada-color)', description: 'Calidad del aire aceptable' },
    Regular: { class: 'regular', icon: <AlertOctagonIcon size={24} />, color: 'var(--status-regular-color)', description: 'Calidad del aire regular' },
    Mala: { class: 'mala', icon: <SkullIcon size={24} />, color: 'var(--status-mala-color)', description: 'Calidad del aire deficiente' }
  };

  // Manejo de datos no disponibles o estado desconocido
  if (!data || !data.estado) {
    const unknownConfig = { class: 'unknown', icon: <HelpCircleIcon size={24} />, color: 'var(--text-muted)', description: 'Estado desconocido' };
    return (
      <div className="air-quality-card">
        <div className="card-header">
          <div className="station-info">
            {/* <div className="station-icon">🏢</div> */}
            <Building2Icon className="station-icon" size={28}/> 
            <div>
              <h2>{data?.estacion || 'Estación Desconocida'}</h2>
              <p className="station-name">Gijón, Asturias</p>
            </div>
          </div>
          <div className="timestamp">
            {/* <span className="time-icon">🕐</span> */}
            <ClockIcon className="time-icon" size={16}/> 
            <span>Datos no disponibles</span>
          </div>
        </div>
        <div className="pm25-section">
          <div className="pm25-label">PM2.5</div>
          <div className="pm25-value">
            <span className="value">--</span>
            <span className="unit">µg/m³</span>
          </div>
          <div className={`quality-status ${unknownConfig.class}`} style={{ color: unknownConfig.color }}>
            <span className="status-icon" style={{ color: unknownConfig.color }}>{unknownConfig.icon}</span>
            <div className="status-content">
              <span className="status-text">Desconocido</span>
              <span className="status-description">{unknownConfig.description}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const config = estadoConfig[data.estado] || estadoConfig.Moderada; // Fallback a Moderada si el estado no coincide
  const fecha = new Date(data.fecha);

  // Calcular el porcentaje para la barra de progreso (PM2.5: 0-15 Buena, 15-25 Moderada, 25-50 Regular, 50+ Mala)
  const getProgressPercentage = (value) => {
    // Escala de 0-50 µg/m³ distribuida en 3 segmentos y saturación completa para >50
    if (value <= 15) {
      // 0-15 ocupa 33% de la barra
      return (value / 15) * 33.33;
    }
    if (value <= 25) {
      // 15-25 ocupa 33% siguiente
      return 33.33 + ((value - 15) / 10) * 33.33;
    }
    if (value <= 50) {
      // 25-50 ocupa último 33%
      return 66.66 + ((value - 25) / 25) * 33.34;
    }
    // ≥50 µg/m³: barra completa
    return 100;
  };
  
  const progressPercentage = getProgressPercentage(data.pm25);

  return (
    <div className="air-quality-card">
      <div className="card-header">
        <div className="station-info">
          {/* Puedes considerar reemplazar estos emojis por iconos SVG también si quieres */}
          {/* <div className="station-icon">🏢</div> */}
          <Building2Icon className="station-icon" size={28}/>
          <div>
            <h2>{data.estacion || "Estación Av. Constitución"}</h2>
            <p className="station-name">Gijón, Asturias</p>
          </div>
        </div>
        <div className="timestamp">
          {/* <span className="time-icon">🕐</span> */}
          <ClockIcon className="time-icon" size={16}/>
          <span>
            {fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - 
            {fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="pm25-section">
        <div className="pm25-label">PM2.5</div>
        <div className="pm25-value">
          <span className="value">{data.pm25}</span>
          <span className="unit">µg/m³</span>
        </div>
        
        <div className="quality-indicator">
          <div className="quality-bar">
            <div 
              className="quality-fill" 
              style={{ 
                width: `${progressPercentage}%`,
                backgroundColor: config.color // Usar el color del estado para la barra
              }}
            ></div>
          </div>
          {/* Marcadores de la barra de calidad, se mantienen */}
          <div className="quality-markers">
            <div className="marker"><span>0</span></div>
            <div className="marker"><span>25</span></div>
            <div className="marker"><span>50+</span></div>
          </div>
        </div>

        <div className={`quality-status ${config.class}`} style={{ color: config.color }}>
          <span className="status-icon" style={{ color: config.color }}>{config.icon}</span>
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