import { useEffect, useState } from "react";
import Header from "./components/Header";
import TabNavigation from "./components/TabNavigation";
import AirQualityCard from "./components/AirQualityCard";
import InfoSection from "./components/InfoSection";
import UpdatesSection from "./components/UpdatesSection";
import LoadingCard from "./components/LoadingCard";
import './App.css';

const API_URL =
  import.meta.env.PROD
    ? "https://air-gijon.onrender.com/api/air/constitucion/pm10"
    : "/api/air/constitucion/pm10";

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('actual');

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app">
      <Header />
      
      <main className="main-content">
        <div className="container">
          <div className="hero-section">
            <h1>Calidad del aire en Gijón</h1>
            <p className="subtitle">Consulta los datos de PM10 de la estación en Av. Constitución</p>
          </div>

          <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

          <div className="content-grid">
            <div className="main-column">
              {activeTab === 'actual' && (
                <>
                  {loading && <LoadingCard />}
                  {!loading && data && !data.error && <AirQualityCard data={data} />}
                  {!loading && data && data.error && (
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
                <div className="coming-soon-card">
                  <div className="coming-soon-icon">📊</div>
                  <h3>Predicción disponible</h3>
                  <p>Previsión para las próximas 24 horas.</p>
                  <small>Funcionalidad en desarrollo</small>
                </div>
              )}
            </div>

            <div className="sidebar">
              <InfoSection />
              <UpdatesSection />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
