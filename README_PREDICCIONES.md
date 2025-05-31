# Sistema de Predicciones - Air Gijón

## Nueva Arquitectura de Predicciones v2.0

### 📋 Resumen

El sistema ha sido completamente reestructurado para separar datos históricos de predicciones, permitiendo múltiples modelos de ML/IA y un mejor control de versiones.

## 🏗️ Arquitectura de Base de Datos

### Tabla `modelos_prediccion`
Almacena información de cada modelo de predicción utilizado:

```sql
- id (SERIAL PRIMARY KEY)
- nombre_modelo (VARCHAR) - ej: "Modelo_0.0", "LSTM_v1.2"
- fecha_inicio_produccion (DATE)
- fecha_fin_produccion (DATE) - nullable para modelo activo
- roc_index (DECIMAL) - métrica de rendimiento
- descripcion (TEXT) - opcional
- activo (BOOLEAN) - solo un modelo puede estar activo
- created_at, updated_at (TIMESTAMP)
```

### Tabla `predicciones`
Almacena todas las predicciones generadas:

```sql
- id (SERIAL PRIMARY KEY)
- fecha (DATE) - fecha para la cual se predice
- estacion_id (VARCHAR) - ID de la estación
- modelo_id (INTEGER) - FK a modelos_prediccion
- parametro (VARCHAR) - "pm25", "pm10", "no2", etc.
- valor (DECIMAL) - valor predicho
- fecha_generacion (TIMESTAMP) - cuándo se generó
- created_at (TIMESTAMP)
```

### Tabla `promedios_diarios` (modificada)
Solo datos históricos reales:

```sql
- fecha (DATE PRIMARY KEY)
- pm25_promedio (DECIMAL)
- pm25_estado (VARCHAR)
- source (VARCHAR)
- created_at, updated_at (TIMESTAMP)
```

## 🚀 Comandos Disponibles

### Migración y Setup
```bash
# Migrar a nueva arquitectura
npm run migrate-predictions

# Generar datos de muestra
npm run generate-sample-data

# Generar predicciones diarias
npm run cron-predictions
```

### Testing
```bash
# Probar conexión BD
npm run test-db

# Iniciar servidor
npm start
```

## 🔗 API Endpoints

### Evolución (compatibilidad anterior)
```
GET /api/air/constitucion/evolucion
```
Devuelve 7 días (5 históricos + 2 predicciones) con información del modelo.

**Respuesta:**
```json
{
  "estacion": "Avenida Constitución",
  "datos": [
    {
      "fecha": "2025-05-31",
      "promedio_pm10": 15.52,
      "tipo": "prediccion",
      "estado": "Moderada",
      "modelo": "Modelo_0.0",
      "roc_index": 0.65
    }
  ],
  "total_dias": 7
}
```

### Gestión de Modelos
```
GET /api/modelos                    # Listar todos los modelos
POST /api/modelos                   # Crear nuevo modelo
PUT /api/modelos/:id/toggle         # Activar/desactivar modelo
PUT /api/modelos/:id/roc           # Actualizar ROC index
```

**Crear modelo:**
```json
POST /api/modelos
{
  "nombre_modelo": "LSTM_v1.0",
  "descripcion": "Red neuronal LSTM con 7 días de contexto",
  "roc_index": 0.75,
  "activar_inmediatamente": true
}
```

### Predicciones Específicas
```
GET /api/predicciones/:estacion/:parametro?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&modelo_id=1
```

**Ejemplos:**
```bash
# Predicciones PM2.5 de Constitución
curl "http://localhost:3000/api/predicciones/6699/pm25"

# Predicciones de un modelo específico
curl "http://localhost:3000/api/predicciones/6699/pm25?modelo_id=1"

# Predicciones en rango de fechas
curl "http://localhost:3000/api/predicciones/6699/pm25?desde=2025-06-01&hasta=2025-06-07"
```

## 🔄 Flujo de Trabajo

### 1. Desarrollo de Nuevo Modelo
```bash
# 1. Crear modelo en BD
curl -X POST http://localhost:3000/api/modelos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_modelo": "RandomForest_v1.0",
    "descripcion": "Random Forest con features meteorológicos",
    "roc_index": 0.72
  }'

# 2. Generar predicciones (modificar cron_predictions.js si es necesario)
npm run cron-predictions

# 3. Activar modelo cuando esté listo
curl -X PUT http://localhost:3000/api/modelos/2/toggle
```

### 2. Evaluación de Rendimiento
```bash
# Actualizar ROC index tras evaluación
curl -X PUT http://localhost:3000/api/modelos/1/roc \
  -H "Content-Type: application/json" \
  -d '{"roc_index": 0.78}'
```

## 📊 Ventajas de la Nueva Arquitectura

### ✅ Escalabilidad
- **Múltiples parámetros**: Fácil añadir PM10, NO2, O3, etc.
- **Múltiples estaciones**: Sistema preparado para más estaciones
- **Versionado de modelos**: Comparar rendimiento entre modelos

### ✅ Trazabilidad
- Cada predicción sabe qué modelo la generó
- Historial completo de todos los modelos
- Fechas de inicio/fin de producción

### ✅ Flexibilidad
- Cambiar modelos activos sin afectar datos
- Consultas específicas por modelo o parámetro
- API genérica para cualquier contaminante

### ✅ Mantenimiento
- Separación clara: históricos vs predicciones
- Código más limpio y modular
- Métricas de rendimiento integradas

## 🧪 Datos de Prueba

El sistema incluye:
- **Modelo_0.0**: Modelo inicial con ROC 0.65
- **15 días históricos**: Valores PM2.5 entre 12-20 µg/m³
- **2 predicciones**: Hoy y mañana, valores 15-25 µg/m³

## 🔧 Personalización

### Algoritmo de Predicción
Modificar `generarPrediccionPM25()` en `cron_predictions.js`:

```javascript
function generarPrediccionPM25(datosHistoricos) {
  // Tu algoritmo personalizado aquí
  // Puede usar APIs externas, ML models, etc.
  return valorPrediccion;
}
```

### Nuevos Parámetros
```sql
-- Ejemplo: añadir predicciones NO2
INSERT INTO predicciones (fecha, estacion_id, modelo_id, parametro, valor)
VALUES ('2025-06-01', '6699', 1, 'no2', 45.5);
```

## 🚨 Notas Importantes

1. **Un solo modelo activo**: Solo puede haber un modelo activo por vez
2. **Constraint único**: (fecha, estacion_id, modelo_id, parametro) debe ser único
3. **Migración**: Ejecutar `npm run migrate-predictions` una sola vez
4. **Compatibilidad**: El endpoint anterior funciona igual pero con más información

## 📈 Próximos Pasos

1. Integrar modelos de ML reales
2. Dashboard para comparar modelos
3. Alertas automáticas por calidad del aire
4. API para entrenar/evaluar modelos
5. Soporte para múltiples estaciones 