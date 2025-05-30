import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Header from "./components/Header";
import TabNavigation from "./components/TabNavigation";
import AirQualityCard from "./components/AirQualityCard";
import EvolutionCard from "./components/EvolutionCard";
import InfoSection from "./components/InfoSection";
import UpdatesSection from "./components/UpdatesSection";
import LoadingCard from "./components/LoadingCard";
import UserDashboard from "./components/UserDashboard";
import AuthModal from "./components/AuthModal";
import './App.css';

const API_URL =
  import.meta.env.PROD
    ? "https://air-gijon.onrender.com/api/air/constitucion/pm25"
    : "/api/air/constitucion/pm25";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('actual');
  const [activeView, setActiveView] = useState('home'); // home, perfil, alertas
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    fetch(API_URL)
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

  const renderMainContent = () => {
    switch (activeView) {
      case 'perfil':
        // Solo mostrar dashboard si está autenticado
        return isAuthenticated ? <UserDashboard /> : null;
      
      case 'alertas':
        return (
          <div className="alerts-page">
            <h1>🔔 Sistema de Alertas</h1>
            <p>Configura cómo quieres recibir notificaciones sobre la calidad del aire.</p>
            <div className="alert-info">
              <h3>Tipos de Alertas Disponibles:</h3>
              <ul>
                <li><strong>Alertas Automáticas:</strong> Cuando PM2.5 &gt; 50 μg/m³</li>
                <li><strong>Predicciones Diarias:</strong> Enviadas cada mañana a las 8:00</li>
                <li><strong>Cambios Significativos:</strong> Cuando la calidad mejora o empeora bruscamente</li>
              </ul>
              {!isAuthenticated ? (
                <div className="auth-required">
                  <p><strong>📝 Para recibir alertas, necesitas registrarte:</strong></p>
                  <button 
                    className="register-btn"
                    onClick={() => setShowAuthModal(true)}
                  >
                    Registrarse Gratis
                  </button>
                </div>
              ) : (
                <p>Puedes configurar tus preferencias en tu perfil.</p>
              )}
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
                <UpdatesSection />
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
        onAuthModalOpen={() => setShowAuthModal(true)}
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
