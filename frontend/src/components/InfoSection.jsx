import InfoIcon from './icons/InfoIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

function InfoSection() {
  return (
    <div className="info-section">
      <div className="info-header">
        {/* <span className="info-icon">ℹ️</span> */}
        <InfoIcon className="info-icon" size={22} /> 
        <h3>Información sobre PM2.5</h3>
      </div>
      
      <div className="info-content">
        <p>Las partículas PM2.5 son partículas en suspensión de menos de 2.5 μm. Son más peligrosas que las PM10 porque pueden penetrar profundamente en los pulmones y llegar al torrente sanguíneo.</p>
        
        <div className="limits-section">
          <div className="limits-header">
            {/* <span className="warning-icon">⚠️</span> */}
            <AlertTriangleIcon className="warning-icon" size={20} />
            <h4>Límites legales</h4>
          </div>
          <p>El límite diario recomendado por la OMS es de <strong>15 μg/m³</strong>.</p>
        </div>
      </div>
    </div>
  );
}

export default InfoSection; 