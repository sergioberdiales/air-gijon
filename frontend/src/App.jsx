import { useEffect, useState } from "react";
import AirQualityCard from "./components/AirQualityCard";

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
    <div style={{ maxWidth: 400, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Air-Gijón</h1>
      {loading && <p>Cargando...</p>}
      {!loading && data && !data.error && <AirQualityCard data={data} />}
      {!loading && data && data.error && <p>No hay datos disponibles.</p>}
    </div>
  );
}

export default App;
