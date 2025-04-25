-- Eliminar la tabla si existe
DROP TABLE IF EXISTS mediciones_api;

-- Crear la tabla con la estructura correcta
CREATE TABLE mediciones_api (
    id SERIAL PRIMARY KEY,
    estacion_id VARCHAR(50) NOT NULL,
    fecha TIMESTAMP NOT NULL,
    parametro VARCHAR(20) NOT NULL,
    valor NUMERIC,
    aqi INTEGER,
    is_validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricción para evitar duplicados
    UNIQUE(estacion_id, fecha, parametro)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_mediciones_api_fecha ON mediciones_api(fecha);
CREATE INDEX idx_mediciones_api_estacion ON mediciones_api(estacion_id);
CREATE INDEX idx_mediciones_api_parametro ON mediciones_api(parametro);

-- Crear trigger para actualizar el timestamp
CREATE OR REPLACE FUNCTION update_mediciones_api_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mediciones_api_timestamp
BEFORE UPDATE ON mediciones_api
FOR EACH ROW
EXECUTE FUNCTION update_mediciones_api_timestamp();

-- Mensaje de confirmación
SELECT 'Tabla mediciones_api recreada correctamente' AS mensaje; 