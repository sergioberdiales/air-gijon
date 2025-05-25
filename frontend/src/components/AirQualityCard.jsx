function AirQualityCard({ data }) {
  const estadoClass = {
    Buena: 'buena',
    Moderada: 'moderada',
    Regular: 'regular',
    Mala: 'mala'
  }[data.estado] || '';

  return (
    <section className="card" aria-label="Calidad del aire">
      <h2 style={{margin:0}}>Estación: {data.estacion}</h2>
      <p>
        <strong>Fecha:</strong> {new Date(data.fecha).toLocaleString()}
      </p>
      <div className="pm10-value" aria-live="polite">
        PM10: <span>{data.pm10}</span> <span style={{fontSize:'1.2rem'}}>µg/m³</span>
      </div>
      <div className={`state ${estadoClass}`}>
        Estado: {data.estado}
      </div>
    </section>
  );
}

export default AirQualityCard;
