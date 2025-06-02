import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useViewport } from '../hooks/useViewport';
import HomeIcon from './icons/HomeIcon';
import LineChartIcon from './icons/LineChartIcon';
import BellIcon from './icons/BellIcon';
import UserIcon from './icons/UserIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import SettingsIcon from './icons/SettingsIcon';
import LogOutIcon from './icons/LogOutIcon';
import CrownIcon from './icons/CrownIcon';

function Header({ activeView, setActiveView, activeTab, setActiveTab, onAuthModalOpen }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { isMobile } = useViewport();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleNavClick = (view) => {
    if (setActiveView) {
      if (view === 'home-actual') {
        // Botón "Inicio" - ir a vista home con pestaña actual
        setActiveView('home');
        if (setActiveTab) {
          setActiveTab('actual');
        }
      } else if (view === 'home-prediccion') {
        // Botón "Predicción" - ir a vista home con pestaña prediccion
        setActiveView('home');
        if (setActiveTab) {
          setActiveTab('prediccion');
        }
      } else {
        // Otros botones (alertas, perfil) - usar vista normal
        setActiveView(view);
      }
    }
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    if (setActiveView) {
      setActiveView('home');
      if (setActiveTab) {
        setActiveTab('actual');
      }
    }
  };

  // Determinar si los botones están activos
  const isHomeActualActive = activeView === 'home' && activeTab === 'actual';
  const isHomePrediccionActive = activeView === 'home' && activeTab === 'prediccion';

  return (
    <>
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <img 
                src="/logos/air_gijon_logo_v1.png" 
                alt="Air Gijón" 
                className="logo-image"
              />
            </div>
            
            <nav className={`nav ${isMobile ? 'bottom-nav' : ''}`}>
              <button 
                className={`nav-link ${isHomeActualActive ? 'active' : ''}`}
                onClick={() => handleNavClick('home-actual')}
              >
                <HomeIcon className="nav-icon" />
                <span className="nav-text">Inicio</span>
              </button>
              <button 
                className={`nav-link ${isHomePrediccionActive ? 'active' : ''}`}
                onClick={() => handleNavClick('home-prediccion')}
              >
                <LineChartIcon className="nav-icon" />
                <span className="nav-text">Predicción</span>
              </button>
              <button 
                className={`nav-link ${activeView === 'alertas' ? 'active' : ''}`}
                onClick={() => handleNavClick('alertas')}
              >
                <BellIcon className="nav-icon" />
                <span className="nav-text">Alertas</span>
              </button>
              
              {/* Mostrar botón Cuenta/Perfil solo si no está autenticado O si es móvil (en móvil sí se necesita) */}
              {(!isAuthenticated || isMobile) && (
                <button 
                  className={`nav-link ${activeView === 'perfil' ? 'active' : ''}`}
                  onClick={() => {
                    if (isAuthenticated) {
                      handleNavClick('perfil'); // En móvil, este botón lleva a perfil
                    } else {
                      onAuthModalOpen(); // En cualquier caso si no está autenticado, abre modal
                    }
                  }}
                >
                  <UserIcon className="nav-icon" />
                  <span className="nav-text">
                    {isAuthenticated ? 'Perfil' : 'Cuenta'} {/* En móvil, si está autenticado, dirá Perfil */}
                  </span>
                </button>
              )}
            </nav>

            {!isMobile && (
              <div className="user-section">
                {isAuthenticated && (
                  <div className="user-menu-container">
                    <button 
                      className="user-btn"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                      <span className="user-avatar">
                        {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={18} />}
                      </span>
                      <span className="user-name">
                        {user?.name || 'Usuario'}
                      </span>
                      <ChevronDownIcon className="dropdown-arrow" />
                    </button>
                    
                    {showUserMenu && (
                      <div className="user-dropdown">
                        <div className="user-info">
                          <p className="user-email">{user?.email}</p>
                          <span className="user-role">
                            {user?.role === 'manager' ? <CrownIcon size={16} style={{ marginRight: '0.25rem' }} /> : <UserIcon size={14} style={{ marginRight: '0.25rem' }} />} 
                            {user?.role === 'manager' ? 'Gestor' : 'Usuario'}
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
                          <SettingsIcon size={16} /> Mi Cuenta
                        </button>
                        <button 
                          className="dropdown-item"
                          onClick={handleLogout}
                        >
                          <LogOutIcon size={16} /> Cerrar Sesión
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {showUserMenu && !isMobile && (
        <div 
          className="overlay"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </>
  );
}

export default Header; 