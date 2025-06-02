import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Header from "./components/Header";
import TabNavigation from "./components/TabNavigation";
import AirQualityCard from "./components/AirQualityCard";
import EvolutionCard from "./components/EvolutionCard";
import InfoSection from "./components/InfoSection";
// import UpdatesSection from "./components/UpdatesSection"; // Comentado
import LoadingCard from "./components/LoadingCard";
import UserDashboard from "./components/UserDashboard";
import AuthModal from "./components/AuthModal";
import UserIcon from "./components/icons/UserIcon";
import { config } from "./config"; // Importar config
import './App.css';

// Usar API_BASE y API_ENDPOINTS de config
const API_URL_PM25 = `${config.API_BASE}${config.API_ENDPOINTS.AIR_QUALITY}`;

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('actual');
  const [activeView, setActiveView] = useState('home'); // home, perfil, alertas
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' o 'register'

  useEffect(() => {
    fetch(API_URL_PM25)
      .then(res => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // Manejar intento de acceso a perfil sin autenticación
  useEffect(() => {
    if (activeView === 'perfil' && !isAuthenticated) {
      setShowAuthModal(true);
      setActiveView('home'); // Redirigir a home
    }
  }, [activeView, isAuthenticated]);

  const openAuthModal = (tab = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'perfil':
        // Solo mostrar dashboard si está autenticado
        return isAuthenticated ? <UserDashboard /> : null;
      
      case 'alertas':
        return (
          <div className="alerts-page">
            <div className="hero-section">
              <h1>Sistema de Alertas</h1>
              <p className="subtitle">Configura cómo quieres recibir notificaciones sobre la calidad del aire</p>
            </div>
            
            <div className="alerts-card">
              <div className="alert-content">
                <div className="alert-types-section">
                  <h3>Tipos de Alertas Disponibles:</h3>
                  <ul className="alert-types-list">
                    <li><strong>Alertas Automáticas:</strong> Cuando PM2.5 &gt; 50 μg/m³</li>
                    <li><strong>Predicciones Diarias:</strong> Enviadas cada mañana a las 8:00</li>
                    <li><strong>Cambios Significativos:</strong> Cuando la calidad mejora o empeora bruscamente</li>
                  </ul>
                </div>

                {!isAuthenticated ? (
                  <div className="auth-required-card">
                    <div className="auth-header">
                      <UserIcon size={20} />
                      <strong>Para recibir alertas, necesitas registrarte:</strong>
                    </div>
                    <button 
                      className="register-btn"
                      onClick={() => openAuthModal('register')}
                    >
                      Registrarse Gratis
                    </button>
                  </div>
                ) : (
                  <div className="authenticated-message">
                    <p>Puedes configurar tus preferencias en tu perfil.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      
      default: // home
        return (
          <>
            <div className="hero-section">
              <h1>Calidad del aire en Gijón</h1>
              <p className="subtitle">Consulta los datos de PM2.5 de la estación en Av. Constitución</p>
            </div>

            <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

            <div className="content-grid">
              <div className="main-column">
                {activeTab === 'actual' && (
                  <>
                    {loading && <LoadingCard />}
                    {!loading && data && !data.error && <AirQualityCard data={data} />}
                    {!loading && (data?.error || !data) && (
                      <div className="error-card">
                        <div className="error-icon">⚠️</div>
                        <h3>No hay datos disponibles</h3>
                        <p>No se pudieron obtener los datos de calidad del aire en este momento.</p>
                        <small>Inténtalo de nuevo más tarde</small>
                      </div>
                    )}
                  </>
                )}
                
                {activeTab === 'prediccion' && (
                  <EvolutionCard />
                )}
              </div>

              <div className="sidebar">
                <InfoSection />
                {/* <UpdatesSection /> */} {/* Comentado */}
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="app">
      <Header 
        activeView={activeView} 
        setActiveView={setActiveView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onAuthModalOpen={() => openAuthModal('login')}
      />
      
      <main className="main-content">
        <div className="container">
          {renderMainContent()}
        </div>
      </main>

      {/* Modal de autenticación */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialTab={authModalTab}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
