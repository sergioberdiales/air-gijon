function InfoSection() {
  return (
    <div className="info-section">
      <div className="info-header">
        <span className="info-icon">ℹ️</span>
        <h3>Información sobre PM10</h3>
      </div>
      
      <div className="info-content">
        <p>Las partículas PM10 son partículas en suspensión de menos de 10 μm. Pueden penetrar en los pulmones y causar problemas respiratorios.</p>
        
        <div className="limits-section">
          <div className="limits-header">
            <span className="warning-icon">⚠️</span>
            <h4>Límites legales</h4>
          </div>
          <p>El límite diario recomendado por la OMS es de <strong>45 μg/m³</strong>.</p>
        </div>
      </div>
    </div>
  );
}

export default InfoSection; 