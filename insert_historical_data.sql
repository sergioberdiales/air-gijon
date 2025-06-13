-- Insertar datos históricos de PM2.5 en promedios_diarios
-- Ejecutar directamente en la base de datos de producción (Render)

-- Función para determinar estado PM2.5
-- (No necesaria, se puede hacer manualmente)

-- Insertar datos de mayo 2025
INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles) VALUES
('2025-05-01', 'pm25', 21, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-02', 'pm25', 35, 'Regular', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-03', 'pm25', 25, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-04', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-05', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-06', 'pm25', 30, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-07', 'pm25', 27, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-08', 'pm25', 43, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-09', 'pm25', 29, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-10', 'pm25', 30, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-11', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-12', 'pm25', 27, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-13', 'pm25', 22, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-14', 'pm25', 27, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-15', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-16', 'pm25', 44, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-17', 'pm25', 37, 'Regular', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-18', 'pm25', 48, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-19', 'pm25', 33, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-20', 'pm25', 37, 'Regular', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-21', 'pm25', 45, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-22', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-23', 'pm25', 28, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-24', 'pm25', 29, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-25', 'pm25', 34, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-26', 'pm25', 22, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-27', 'pm25', 23, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-28', 'pm25', 37, 'Regular', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-29', 'pm25', 40, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-30', 'pm25', 44, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-05-31', 'pm25', 21, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución');

-- Insertar datos de junio 2025
INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles) VALUES
('2025-06-01', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-02', 'pm25', 24, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-03', 'pm25', 24, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-04', 'pm25', 32, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-05', 'pm25', 29, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-06', 'pm25', 27, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-07', 'pm25', 26, 'Buena', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-08', 'pm25', 37, 'Regular', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-09', 'pm25', 47, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución'),
('2025-06-10', 'pm25', 48, 'Insalubre para grupos sensibles', 'csv_historical', 'Datos históricos Estación Constitución');

-- Verificar que se insertaron correctamente
SELECT 
  COUNT(*) as total_registros,
  MIN(fecha) as fecha_inicio,
  MAX(fecha) as fecha_fin,
  AVG(valor) as promedio_pm25
FROM promedios_diarios 
WHERE parametro = 'pm25' 
  AND source = 'csv_historical'
  AND fecha >= '2025-05-01' 
  AND fecha <= '2025-06-10';

-- Mostrar algunos registros de ejemplo
SELECT fecha, valor, estado 
FROM promedios_diarios 
WHERE parametro = 'pm25' 
  AND source = 'csv_historical'
  AND fecha >= '2025-06-05'
ORDER BY fecha DESC; 