import { useAuth } from '../contexts/AuthContext';
import HomeIcon from './icons/HomeIcon';
import LineChartIcon from './icons/LineChartIcon';
import BellIcon from './icons/BellIcon';
import UserIcon from './icons/UserIcon';
import AdminIcon from './icons/AdminIcon';
import XIcon from './icons/XIcon';
import './MobileMenu.css';

function MobileMenu({ 
  isOpen, 
  onClose, 
  activeView, 
  activeTab, 
  onNavClick, 
  onAuthModalOpen 
}) {
  const { user, isAuthenticated } = useAuth();

  const handleNavClick = (view) => {
    onNavClick(view);
    onClose(); // Cerrar el menú después de navegar
  };

  // Determinar si los botones están activos
  const isHomeActualActive = activeView === 'home' && activeTab === 'actual';
  const isHomePrediccionActive = activeView === 'home' && activeTab === 'prediccion';

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay que cierra el menú al hacer clic fuera */}
      <div className="mobile-menu-overlay" onClick={onClose}></div>
      
      {/* Menú deslizable */}
      <div className="mobile-menu">
        {/* Botón cerrar como overlay */}
        <button className="mobile-menu-close" onClick={onClose}>
          <XIcon />
        </button>
        
        <nav className="mobile-menu-nav">
          <button 
            className={`mobile-menu-item ${isHomeActualActive ? 'active' : ''}`}
            onClick={() => handleNavClick('home-actual')}
          >
            <HomeIcon className="mobile-menu-icon" />
            <span>Inicio</span>
          </button>
          
          <button 
            className={`mobile-menu-item ${isHomePrediccionActive ? 'active' : ''}`}
            onClick={() => handleNavClick('home-prediccion')}
          >
            <LineChartIcon className="mobile-menu-icon" />
            <span>Predicción</span>
          </button>
          
          <button 
            className={`mobile-menu-item ${activeView === 'alertas' ? 'active' : ''}`}
            onClick={() => handleNavClick('alertas')}
          >
            <BellIcon className="mobile-menu-icon" />
            <span>Alertas</span>
          </button>
          
          {/* Mostrar botón Admin solo para administradores */}
          {isAuthenticated && user?.role_name === 'admin' && (
            <button 
              className={`mobile-menu-item ${activeView === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavClick('admin')}
            >
              <AdminIcon className="mobile-menu-icon" />
              <span>Administración</span>
            </button>
          )}
          
          {/* Botón de cuenta/perfil */}
          <button 
            className={`mobile-menu-item ${activeView === 'perfil' ? 'active' : ''}`}
            onClick={() => {
              if (isAuthenticated) {
                handleNavClick('perfil');
              } else {
                onAuthModalOpen();
                onClose();
              }
            }}
          >
            <UserIcon className="mobile-menu-icon" />
            <span>{isAuthenticated ? 'Mi Perfil' : 'Iniciar Sesión'}</span>
          </button>
        </nav>
      </div>
    </>
  );
}

export default MobileMenu;
