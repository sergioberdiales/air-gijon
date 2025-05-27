import { useEffect, useState } from "react";
import Header from "./components/Header";
import TabNavigation from "./components/TabNavigation";
import AirQualityCard from "./components/AirQualityCard";
import EvolutionCard from "./components/EvolutionCard";
import InfoSection from "./components/InfoSection";
import UpdatesSection from "./components/UpdatesSection";
import LoadingCard from "./components/LoadingCard";
import './App.css';

const API_URL =
  import.meta.env.PROD
    ? "https://air-gijon.onrender.com/api/air/constitucion/pm25"
    : "/api/air/constitucion/pm25";

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
            <p className="subtitle">Consulta los datos de PM2.5 de la estación en Av. Constitución</p>
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
                <EvolutionCard />
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
