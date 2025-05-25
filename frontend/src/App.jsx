import { useEffect, useState } from "react";
import AirQualityCard from "./components/AirQualityCard";
import './App.css';

const API_URL =
  import.meta.env.PROD
    ? "https://air-gijon.onrender.com/api/air/constitucion/pm10"
    : "/api/air/constitucion/pm10";

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <header className="header">Air-Gijón</header>
      {loading && <p style={{textAlign:'center'}}>Cargando...</p>}
      {!loading && data && !data.error && <AirQualityCard data={data} />}
      {!loading && data && data.error && <p style={{textAlign:'center'}}>No hay datos disponibles.</p>}
    </main>
  );
}

export default App;
