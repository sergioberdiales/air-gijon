-- Script para actualizar la tabla predicciones con columna horizonte_dias

-- 1. Agregar la columna horizonte_dias si no existe
ALTER TABLE predicciones 
ADD COLUMN IF NOT EXISTS horizonte_dias INTEGER DEFAULT 0;

-- 2. Actualizar datos existentes (si los hay) para establecer horizonte_dias
UPDATE predicciones 
SET horizonte_dias = 0 
WHERE horizonte_dias IS NULL;

-- 3. Eliminar el constraint único anterior
ALTER TABLE predicciones 
DROP CONSTRAINT IF EXISTS predicciones_fecha_estacion_id_modelo_id_parametro_key;

-- 4. Crear el nuevo constraint único que incluye horizonte_dias
ALTER TABLE predicciones 
ADD CONSTRAINT predicciones_fecha_estacion_modelo_parametro_horizonte_unique 
UNIQUE (fecha, estacion_id, modelo_id, parametro, horizonte_dias);

-- 5. Crear índice para mejorar rendimiento con horizonte_dias
CREATE INDEX IF NOT EXISTS idx_predicciones_horizonte_fecha 
ON predicciones(horizonte_dias, fecha);

-- Mensaje de confirmación
SELECT 'Tabla predicciones actualizada con columna horizonte_dias y constraint corregido' AS mensaje; 