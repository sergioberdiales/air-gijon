import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function Header({ activeView, setActiveView, onAuthModalOpen }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleNavClick = (view) => {
    if (setActiveView) {
      setActiveView(view);
    }
  };

  const handleProfileClick = () => {
    if (isAuthenticated) {
      setShowUserMenu(!showUserMenu);
    } else {
      onAuthModalOpen();
    }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    if (setActiveView) {
      setActiveView('home');
    }
  };

  return (
    <>
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <span className="logo-text">Air Gijón</span>
            </div>
            
            <nav className="nav">
              <button 
                className={`nav-link ${activeView === 'home' ? 'active' : ''}`}
                onClick={() => handleNavClick('home')}
              >
                <span className="nav-icon">🏠</span>
                <span className="nav-text">Inicio</span>
              </button>
              <button 
                className={`nav-link ${activeView === 'prediccion' ? 'active' : ''}`}
                onClick={() => handleNavClick('prediccion')}
              >
                <span className="nav-icon">📈</span>
                <span className="nav-text">Predicción</span>
              </button>
              <button 
                className={`nav-link ${activeView === 'alertas' ? 'active' : ''}`}
                onClick={() => handleNavClick('alertas')}
              >
                <span className="nav-icon">🔔</span>
                <span className="nav-text">Alertas</span>
              </button>
              <button 
                className={`nav-link ${activeView === 'perfil' ? 'active' : ''}`}
                onClick={() => {
                  if (isAuthenticated) {
                    handleNavClick('perfil');
                  } else {
                    onAuthModalOpen();
                  }
                }}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">
                  {isAuthenticated ? 'Perfil' : 'Cuenta'}
                </span>
              </button>
            </nav>

            <div className="user-section">
              {isAuthenticated ? (
                <div className="user-menu-container">
                  <button 
                    className="user-btn"
                    onClick={handleProfileClick}
                  >
                    <span className="user-avatar">
                      {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
                    </span>
                    <span className="user-name desktop-only">
                      {user?.name || 'Usuario'}
                    </span>
                    <span className="dropdown-arrow">▼</span>
                  </button>
                  
                  {showUserMenu && (
                    <div className="user-dropdown">
                      <div className="user-info">
                        <p className="user-email">{user?.email}</p>
                        <span className="user-role">
                          {user?.role === 'manager' ? '👑 Gestor' : '👤 Usuario'}
                        </span>
                      </div>
                      <hr />
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          handleNavClick('perfil');
                          setShowUserMenu(false);
                        }}
                      >
                        <span>⚙️</span> Configuración
                      </button>
                      <button 
                        className="dropdown-item"
                        onClick={handleLogout}
                      >
                        <span>🚪</span> Cerrar Sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  className="login-btn desktop-only"
                  onClick={onAuthModalOpen}
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Click outside handler para cerrar el menú */}
      {showUserMenu && (
        <div 
          className="overlay"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </>
  );
}

export default Header; 