# 🚀 Demo Local - Air Gijón con Nueva Arquitectura de Predicciones

## ✅ Estado Actual
- ✅ **Backend corriendo**: http://localhost:3000
- ✅ **Frontend corriendo**: http://localhost:5173
- ✅ **Nueva arquitectura implementada**: Modelos y predicciones separados
- ✅ **Datos de muestra**: 15 días históricos + 2 predicciones

## 🌐 URLs para Probar

### Frontend
```
http://localhost:5173
```
La aplicación React con la interfaz de usuario completa.

### Backend - API Endpoints

#### Endpoint Principal (Compatibilidad)
```
http://localhost:3000/api/air/constitucion/evolucion
```
Devuelve 7 días de datos (5 históricos + 2 predicciones) con información del modelo.

#### Gestión de Modelos
```
http://localhost:3000/api/modelos
```
Lista todos los modelos de predicción disponibles.

#### Predicciones Específicas
```
http://localhost:3000/api/predicciones/6699/pm25
```
Predicciones específicas de PM2.5 para la estación Constitución.

#### Estado Actual de PM2.5
```
http://localhost:3000/api/air/constitucion/pm25
```
Último valor de PM2.5 registrado.

## 🔧 Comandos de Administración

### Ver datos en tiempo real
```bash
# Backend logs
tail -f server.log

# Generar nuevas predicciones
npm run cron-predictions

# Ver estado de la base de datos
npm run stats
```

### Probar nuevas funcionalidades
```bash
# Crear un nuevo modelo
curl -X POST http://localhost:3000/api/modelos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_modelo": "Modelo_Demo_v1.0",
    "descripcion": "Modelo de demostración con mejor precisión",
    "roc_index": 0.75
  }'

# Activar el nuevo modelo
curl -X PUT http://localhost:3000/api/modelos/2/toggle

# Ver predicciones del nuevo modelo
curl "http://localhost:3000/api/predicciones/6699/pm25?modelo_id=2"
```

## 🎯 Puntos Clave de la Demo

### 1. **Separación de Datos**
- **Históricos**: Solo en `promedios_diarios`
- **Predicciones**: En tabla `predicciones` con trazabilidad del modelo

### 2. **Versionado de Modelos**
- Cada predicción sabe qué modelo la generó
- ROC Index para medir rendimiento
- Activar/desactivar modelos sin perder datos

### 3. **Escalabilidad**
- Estructura genérica (parametro/valor)
- Fácil añadir PM10, NO2, O3
- Preparado para múltiples estaciones

### 4. **API Completa**
- Endpoints REST para todas las operaciones
- Queries flexibles con filtros
- Compatibilidad con frontend existente

## 📊 Datos de Muestra Actuales

- **Modelo activo**: Modelo_0.0 (ROC: 0.65)
- **Datos históricos**: 15 días (PM2.5: 12-20 µg/m³)
- **Predicciones**: Hoy y mañana (PM2.5: 15-25 µg/m³)
- **Estados**: Mayormente "Moderada" (15-25 µg/m³)

## 🔍 Verificación del Sistema

### 1. Verificar que todo funciona
```bash
# Backend API
curl http://localhost:3000/api/modelos | python3 -m json.tool

# Frontend
curl http://localhost:5173 | grep -i "air"

# Base de datos
npm run test-db
```

### 2. Estado de los servicios
```bash
ps aux | grep -E "(node|vite)" | grep -v grep
```

### 3. Logs en tiempo real
```bash
# Terminal 1: Backend logs
cd /Users/sergio/projects/air-gijon && npm start

# Terminal 2: Frontend logs  
cd /Users/sergio/projects/air-gijon/frontend && npm run dev
```

## 🎉 Listo para la Demo!

La aplicación está completamente funcional con:
- ✅ Nueva arquitectura de predicciones
- ✅ Frontend React conectado
- ✅ API completa para gestión de modelos  
- ✅ Datos de muestra realistas
- ✅ Documentación completa

**Abre tu navegador en**: http://localhost:5173 