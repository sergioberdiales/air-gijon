function UpdatesSection() {
  return (
    <div className="updates-section">
      <div className="updates-header">
        <span className="updates-icon">📊</span>
        <h3>Últimas actualizaciones</h3>
      </div>
      
      <div className="updates-content">
        <div className="update-item">
          <span className="update-icon">📅</span>
          <div className="update-info">
            <h4>Actualización diaria</h4>
            <p>Los datos se actualizan cada hora.</p>
          </div>
        </div>
        
        <div className="update-item">
          <span className="update-icon">📈</span>
          <div className="update-info">
            <h4>Predicción disponible</h4>
            <p>Previsión para las próximas 24 horas.</p>
          </div>
        </div>
        
        <div className="update-item">
          <span className="update-icon">🔔</span>
          <div className="update-info">
            <h4>Alertas personalizadas</h4>
            <p><a href="#" className="link">Iniciar sesión</a> para recibir notificaciones.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdatesSection; 