function AirQualityCard({ data }) {
  return (
    <div style={{
      border: "1px solid #eee",
      borderRadius: 12,
      padding: 24,
      background: "#fafbfc",
      marginTop: 24
    }}>
      <h2>Estación: {data.estacion}</h2>
      <p><strong>Fecha:</strong> {new Date(data.fecha).toLocaleString()}</p>
      <p style={{ fontSize: 32, margin: "1rem 0" }}>
        PM10: <strong>{data.pm10} µg/m³</strong>
      </p>
      <p>
        Estado: <span style={{
          color: data.estado === "Buena" ? "green" :
                data.estado === "Moderada" ? "orange" :
                data.estado === "Regular" ? "goldenrod" : "red"
        }}>{data.estado}</span>
      </p>
    </div>
  );
}

export default AirQualityCard;
