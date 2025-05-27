function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <span className="logo-text">Air Gijón</span>
          </div>
          
          <nav className="nav">
            <a href="#" className="nav-link active">
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Inicio</span>
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">📈</span>
              <span className="nav-text">Predicción</span>
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">🔔</span>
              <span className="nav-text">Alertas</span>
            </a>
            <a href="#" className="nav-link">
              <span className="nav-icon">👤</span>
              <span className="nav-text">Perfil</span>
            </a>
          </nav>

          <button className="login-btn desktop-only">
            Iniciar sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header; 