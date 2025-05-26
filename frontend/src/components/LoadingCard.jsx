function LoadingCard() {
  return (
    <div className="loading-card">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <div className="loading-text">
          <h3>Cargando datos...</h3>
          <p>Obteniendo información de calidad del aire</p>
        </div>
      </div>
      <div className="loading-shimmer">
        <div className="shimmer-line long"></div>
        <div className="shimmer-line medium"></div>
        <div className="shimmer-line short"></div>
      </div>
    </div>
  );
}

export default LoadingCard; 