# Memoria Técnica: Sistema de Predicciones de Calidad del Aire

## Proyecto: Air Gijón - Monitoreo y Predicción de PM2.5

---

## 1. Introducción

El proyecto Air Gijón ha evolucionado desde un simple sistema de monitoreo de calidad del aire hasta una plataforma completa que incluye **predicciones automáticas de PM2.5** basadas en algoritmos de análisis histórico y automatización mediante cron jobs.

---

## 2. Arquitectura del Sistema de Predicciones

### 2.1 Componentes Principales

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Base de       │
│   (React)       │◄──►│   (Node.js)      │◄──►│   Datos         │
│                 │    │                  │    │   (PostgreSQL)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Cron Job       │
                       │   Predicciones   │
                       │   (4:30 AM UTC)  │
                       └──────────────────┘
```

### 2.2 Flujo de Datos de Predicciones

1. **Recolección de Datos Históricos**
   - Datos PM2.5 de la estación Avenida Constitución (ID: 6699)
   - Almacenamiento en tabla `mediciones_api`
   - Cálculo de promedios diarios en tabla `promedios_diarios`

2. **Generación de Predicciones**
   - Algoritmo ponderado semanal
   - Análisis de patrones históricos
   - Consideración de días de la semana (sábados/lunes tienen comportamiento diferente)

3. **Automatización**
   - Cron job diario a las 4:30 AM UTC
   - Actualización automática de predicciones
   - Integración con fuentes de datos WAQI

---

## 3. Algoritmo de Predicciones

### 3.1 Modelo Matemático

```javascript
prediccion = (valor_ayer × peso_ayer) + (valor_hace_7_dias × peso_semana_anterior)
```

### 3.2 Pesos Dinámicos por Día de la Semana

| Día de la Semana | Peso Ayer | Peso Semana Anterior | Razón |
|------------------|-----------|---------------------|-------|
| Lunes - Viernes  | 0.75      | 0.25               | Continuidad laboral |
| Sábado/Lunes     | 0.25      | 0.75               | Cambio de patrón |

### 3.3 Niveles de Confianza

- **Alta (0.8-0.9)**: Datos completos, días laborales
- **Media (0.6-0.7)**: Datos parciales o fin de semana
- **Baja (0.4-0.5)**: Datos insuficientes o fallback

---

## 4. Implementación Técnica

### 4.1 Estructura de Base de Datos

#### Tabla `promedios_diarios`
```sql
CREATE TABLE promedios_diarios (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    promedio_pm10 DECIMAL(5,2), -- Columna legacy que almacena PM2.5
    tipo VARCHAR(20) NOT NULL, -- 'historico', 'prediccion'
    algoritmo VARCHAR(50),
    confianza DECIMAL(3,2),
    datos_utilizados INTEGER,
    detalles JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Funciones Clave

#### `obtenerEvolucion()`
- Obtiene 5 días históricos + predicciones de hoy y mañana
- Manejo simplificado de fechas para evitar errores de timezone
- Mapeo de datos PM2.5 con estados de calidad del aire

#### `runDailyUpdateAndPredictions()`
- Orquesta la actualización diaria completa
- Prioriza datos WAQI sobre cálculos locales
- Implementa fallbacks robustos

#### `calcularPredicciones()`
- Algoritmo ponderado con consideración semanal
- Validación de disponibilidad de datos
- Cálculo de niveles de confianza

### 4.3 Archivo de Cron Job

#### `cron_predictions.js`
```javascript
// Script ejecutado diariamente a las 4:30 AM UTC
const { runDailyUpdateAndPredictions } = require('./promedios_predicciones');

async function main() {
    await runDailyUpdateAndPredictions();
}
```

---

## 5. Dificultades Técnicas Encontradas y Soluciones

### 5.1 Concurrencia de Base de Datos

#### Problema:
```
Error: tuple concurrently updated
```

#### Causa:
- Múltiples instancias del servidor intentando crear tablas simultáneamente
- Operaciones concurrentes en PostgreSQL

#### Solución Implementada:
```javascript
let isInitializing = false;
let isInitialized = false;

async function createTables() {
    if (isInitializing) {
        console.log('⏳ Las tablas ya están siendo inicializadas por otro proceso...');
        return;
    }
    
    if (isInitialized) {
        return;
    }
    
    isInitializing = true;
    try {
        // Crear tablas con manejo de errores
        await pool.query(CREATE_TABLE_SQL);
        isInitialized = true;
    } catch (error) {
        if (error.message.includes('tuple concurrently updated')) {
            // Manejo graceful del error de concurrencia
            console.warn('⚠️ Error de concurrencia detectado, continuando...');
            return;
        }
        throw error;
    } finally {
        isInitializing = false;
    }
}
```

### 5.2 Conflictos de Puerto

#### Problema:
```
Error: listen EADDRINUSE: address already in use :::3000
```

#### Solución:
```javascript
async function findAvailablePort(startPort = 3000) {
    const net = require('net');
    
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                findAvailablePort(startPort + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}
```

### 5.3 Módulos Faltantes

#### Problema:
```
Error: Cannot find module './utils'
```

#### Solución:
Creación del archivo `utils.js` con funciones centralizadas:
```javascript
function getEstadoPM25(pm25) {
    if (pm25 <= 15) return 'Buena';
    if (pm25 <= 25) return 'Moderada';
    if (pm25 <= 50) return 'Regular';
    return 'Mala';
}
```

### 5.4 Errores de Timezone

#### Problema:
```
TypeError: utcToZonedTime is not a function
```

#### Solución:
Simplificación del manejo de fechas:
```javascript
// En lugar de manejo complejo de timezones
const hoy = new Date();
const hoyStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD
```

### 5.5 Inconsistencias en Esquema de Base de Datos

#### Problema:
- Columna `promedio_pm10` almacenaba datos de PM2.5
- Nombres de columna confusos (`pm25_promedio` vs `promedio_pm10`)

#### Solución:
```javascript
// Usar nombres de columna reales encontrados en la base de datos
const result = await pool.query(`
    SELECT fecha, promedio_pm10, tipo, confianza 
    FROM promedios_diarios 
    WHERE tipo = 'historico' AND fecha < $1 
    ORDER BY fecha DESC 
    LIMIT 5
`, [hoyStr]);
```

---

## 6. Configuración de Deployment

### 6.1 Render - Web Service
```bash
Build Command: npm install
Start Command: npm start
Environment Variables:
- DATABASE_URL: postgresql://...
- NODE_ENV: production
```

### 6.2 Render - Cron Job
```bash
Schedule: 30 4 * * * (4:30 AM UTC)
Build Command: npm install
Start Command: npm run cron-predictions
Environment Variables:
- DATABASE_URL: postgresql://... (mismo que web service)
- NODE_ENV: production
- TZ: Europe/Madrid
```

---

## 7. Mejoras Implementadas

### 7.1 Robustez del Sistema
- Manejo graceful de errores de concurrencia
- Detección automática de puertos disponibles
- Fallbacks para datos faltantes
- Validación de disponibilidad de datos

### 7.2 Automatización
- Cron job completamente automatizado
- Integración con fuentes de datos externas (WAQI)
- Actualización automática de predicciones

### 7.3 Optimización de Performance
- Índices optimizados para consultas históricas
- Queries SQL eficientes
- Caching mediante HTTP 304 (Not Modified)

---

## 8. Métricas y Monitoring

### 8.1 Endpoints de API
- `/api/air/constitucion/pm25` - Datos actuales
- `/api/air/constitucion/evolucion` - Evolución + predicciones

### 8.2 Logs de Monitoreo
- Conexiones a base de datos exitosas
- Ejecuciones de cron job
- Errores y recuperación automática

### 8.3 Estados de Respuesta HTTP
- **200**: Datos actualizados
- **304**: Not Modified (optimización de caché)
- **404**: No hay datos disponibles
- **500**: Error interno del servidor

---

## 9. Conclusiones Técnicas

### 9.1 Logros Alcanzados
1. **Sistema de predicciones funcional** con algoritmo ponderado semanal
2. **Automatización completa** mediante cron jobs en Render
3. **Alta disponibilidad** con manejo robusto de errores
4. **Optimización de recursos** con detección automática de puertos

### 9.2 Arquitectura Resiliente
- Recuperación automática de errores de concurrencia
- Fallbacks para datos faltantes
- Manejo graceful de fallos de red

### 9.3 Escalabilidad
- Estructura modular preparada para múltiples estaciones
- Base de datos optimizada para crecimiento
- APIs RESTful estándar para integración

---

## 10. Próximos Pasos Recomendados

1. **Mejora del algoritmo de predicciones**
   - Incorporar variables meteorológicas
   - Machine Learning para patrones más complejos

2. **Expansión del sistema**
   - Soporte para múltiples estaciones
   - Predicciones a largo plazo (7 días)

3. **Optimizaciones adicionales**
   - Implementar Redis para caching
   - Métricas detalladas con Prometheus

---

**Documento generado:** 28 de Mayo 2025  
**Versión del sistema:** 1.0.0  
**Estado:** Producción - Completamente operacional 