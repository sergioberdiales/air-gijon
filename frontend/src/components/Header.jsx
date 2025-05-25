function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <span className="logo-text">AirWise Gijón</span>
          </div>
          
          <nav className="nav">
            <a href="#" className="nav-link active">
              <span className="nav-icon">🏠</span>
              Inicio
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">🗺️</span>
              Mapa
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">📈</span>
              Predicción
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">🔔</span>
              Alertas
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">👤</span>
              Perfil
            </a>
          </nav>

          <button className="login-btn">
            Iniciar sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header; 