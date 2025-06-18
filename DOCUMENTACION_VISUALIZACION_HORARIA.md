# 📊 DOCUMENTACIÓN: VISUALIZACIÓN DE VALORES HORARIOS

## 🎯 **RESUMEN EJECUTIVO**

Este documento describe el **proceso completo de visualización de valores horarios** en Air Gijón, desde la captura automática de datos cada hora hasta el envío de alertas por email cuando se detectan niveles peligrosos de PM2.5.

---

## 🔄 **ARQUITECTURA DEL PROCESO HORARIO**

```mermaid
graph TD
    A[🕐 Cron Job Horario<br/>scripts/cron/cron_update.js] --> B[📡 API AQICN<br/>src/services/api_aqicn.js]
    B --> C[💾 Tabla mediciones_api<br/>PostgreSQL]
    C --> D[🌐 Endpoint Web<br/>/api/air/constitucion/actual]
    C --> E[🔍 Monitor Alertas<br/>scripts/cron/send_hourly_alerts.js]
    E --> F[📧 Envío de Alertas<br/>src/services/email_service.js]
    F --> G[👥 Usuarios Suscritos]
    
    H[🎯 Frontend React] --> D
    D --> I[📊 Visualización Tiempo Real]
```

---

## 📅 **FASE 1: CAPTURA AUTOMÁTICA DE DATOS**

### **🤖 Cron Job Principal**
- **Archivo**: `scripts/cron/cron_update.js`
- **Ejecución**: Cada hora (configurado en Render)
- **Función**: Capturar datos actuales de calidad del aire

#### **⚙️ Configuración del Cron:**
```javascript
// Ejecutado automáticamente cada hora por Render
// Configuración: 0 * * * * (cada hora en punto)
```

#### **🔧 Proceso de Ejecución:**
1. **Verificación de conexión**: Test de base de datos
2. **Obtención de datos**: Llamada a API AQICN
3. **Almacenamiento**: Inserción en tabla `mediciones_api`
4. **Estadísticas**: Reporte de datos actualizados
5. **Limpieza**: Cierre de conexiones

### **📡 Servicio API AQICN**
- **Archivo**: `src/services/api_aqicn.js`
- **Estación**: `6699` (Avenida Constitución, Gijón)
- **Parámetros capturados**: PM2.5, PM10, NO2, O3, SO2, CO, etc.

#### **🔄 Funciones Principales:**

```javascript
// 1. Obtener datos de AQICN
async function getAirQualityData(stationId)

// 2. Almacenar en base de datos
async function storeAirQualityData(data)

// 3. Verificar duplicados
async function checkExistingData(stationId, measurementTime)

// 4. Estadísticas de datos
async function getDataStats()
```

#### **📊 Estructura de Datos Capturados:**
```javascript
{
  timestamp: "2025-06-17T10:00:00Z",
  stationId: "6699",
  aqi: 45,
  measurementTime: "2025-06-17T10:00:00+02:00",
  parameters: [
    { parameter: "pm25", value: 32 },
    { parameter: "pm10", value: 45 },
    { parameter: "no2", value: 28 },
    // ... otros parámetros
  ]
}
```

---

## 💾 **FASE 2: ALMACENAMIENTO EN BASE DE DATOS**

### **🗄️ Tabla `mediciones_api`**
- **Propósito**: Almacenar mediciones horarias en tiempo real
- **Estructura**:

```sql
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
```

### **🔄 Lógica de Inserción:**
1. **Verificación de duplicados**: Por estación, fecha y parámetro
2. **Actualización inteligente**: Si existe, actualiza valores
3. **Inserción múltiple**: Un registro por parámetro
4. **Validación**: Marca como `is_validated = true`

### **📈 Gestión de Datos:**
- **Retención**: Datos históricos conservados (limpieza deshabilitada)
- **Optimización**: Índices en fecha, estación y parámetro
- **Integridad**: Constraints para evitar duplicados

---

## 🌐 **FASE 3: EXPOSICIÓN VÍA API WEB**

### **📡 Endpoint Principal**
- **Ruta**: `/api/air/constitucion/actual`
- **Archivo**: `src/routes/air.js`
- **Método**: GET
- **Propósito**: Proporcionar datos actuales para la interfaz web

#### **🔍 Consulta SQL:**
```sql
SELECT 
  fecha,
  parametro,
  valor,
  aqi,
  EXTRACT(EPOCH FROM (NOW() - fecha))/3600 as horas_desde_medicion
FROM mediciones_api 
WHERE estacion_id = '6699' 
  AND parametro = 'pm25'
  AND valor IS NOT NULL
ORDER BY fecha DESC 
LIMIT 1
```

#### **📊 Respuesta JSON:**
```javascript
{
  "success": true,
  "data": {
    "estacion": "Avenida Constitución",
    "fecha": "2025-06-17T10:00:00Z",
    "pm25": 32,
    "estado": "Regular",
    "aqi": 45,
    "horasDesde": 0.5,
    "parametros": {
      "pm10": 45,
      "no2": 28,
      "o3": 85
    }
  }
}
```

---

## 🔍 **FASE 4: MONITOREO Y ALERTAS**

### **🚨 Sistema de Alertas Horarias**
- **Archivo**: `scripts/cron/send_hourly_alerts.js`
- **Ejecución**: Cada hora (después de actualización de datos)
- **Umbral**: PM2.5 > 50 µg/m³
- **Restricción**: Máximo 1 alerta por usuario por día

#### **⚙️ Proceso de Verificación:**
1. **Obtener última medición**: Consulta más reciente de PM2.5
2. **Evaluar umbral**: Comparar con 50 µg/m³
3. **Consultar usuarios**: Obtener suscritos a alertas
4. **Verificar restricciones**: Comprobar si ya recibió alerta hoy
5. **Enviar alertas**: Usar servicio de email

#### **📧 Lógica de Envío:**
```javascript
// Verificar si supera umbral
const esAlerta = valor > ALERT_THRESHOLD; // 50 µg/m³

// Verificar restricción diaria
const alreadyReceived = await hasUserReceivedAlertToday(user.id);

// Verificar medición específica
const alreadySent = await hasAlertBeenSentForMeasurement(
  user.id, 
  alertData.fecha, 
  ESTACION_ID, 
  'pm25'
);
```

### **📊 Datos de Alerta:**
```javascript
{
  valor: 65,                    // µg/m³ redondeado
  estado: "Insalubre",         // Según OMS
  estacion: "Avenida Constitución",
  fecha: "2025-06-17T10:00:00Z",
  horasDesde: 0.5,             // Tiempo desde medición
  esAlerta: true               // Si supera umbral
}
```

---

## 📧 **FASE 5: SERVICIO DE EMAIL**

### **✉️ Plantilla de Alerta**
- **Archivo**: `src/services/email_service.js`
- **Función**: `sendAirQualityAlert()`
- **Template**: `getAlertTemplate()`

#### **🎨 Contenido del Email:**
- **Asunto**: `🚨 Alerta de Calidad del Aire: [Estado] en [Estación]`
- **Valor actual**: Destacado con color según estado
- **Recomendaciones OMS**: Según nivel de PM2.5
- **Información temporal**: Fecha y hora de medición
- **Enlace a web**: Para seguimiento detallado

#### **📋 Ejemplo de Email:**
```html
<h2>🚨 Alerta de Calidad del Aire</h2>
<div class="metric">
  <div class="value">65</div>
  <div class="unit">µg/m³ PM2.5</div>
</div>
<div class="quality-badge" style="background-color: #ff6b6b;">
  Insalubre
</div>
<p>La calidad del aire es mala (>50 µg/m³). 
   Evita el ejercicio al aire libre.</p>
```

### **👥 Gestión de Usuarios:**
- **Suscripción**: Solo usuarios con `email_alerts = true`
- **Restricción diaria**: Máximo 1 alerta por día por usuario
- **Logging**: Registro en tabla `notificaciones_enviadas`
- **Estados**: `sent`, `failed`, `pending`

---

## 📊 **FASE 6: VISUALIZACIÓN EN FRONTEND**

### **⚛️ Componente Principal**
- **Archivo**: `frontend/src/components/AirQualityCard.jsx`
- **Actualización**: Tiempo real vía polling
- **Frecuencia**: Cada 5 minutos

#### **🎨 Elementos Visuales:**
- **Valor PM2.5**: Número grande con unidades
- **Estado**: Badge colorizado según OMS
- **Timestamp**: Tiempo desde última medición
- **Barra de progreso**: Visual del nivel de contaminación
- **Iconos**: Indicadores visuales de estado

#### **🌈 Código de Colores:**
```javascript
const estadoConfig = {
  'Buena': { color: '#10b981' },      // Verde
  'Regular': { color: '#f59e0b' },     // Amarillo
  'Insalubre': { color: '#ef4444' },   // Rojo
  'Muy insalubre': { color: '#991b1b' } // Rojo oscuro
};
```

---

## 🔧 **CONFIGURACIÓN Y MANTENIMIENTO**

### **⚙️ Variables de Entorno:**
```bash
# API AQICN
AQICN_API_KEY=your_api_key_here

# Email (Gmail)
EMAIL_USER=airgijon@gmail.com
EMAIL_PASS=app_password_here

# Base de datos
DATABASE_URL=postgresql://user:pass@host:port/db
```

### **📋 Cron Jobs Configurados:**
```bash
# Actualización horaria de datos
0 * * * * node scripts/cron/cron_update.js

# Verificación de alertas horarias  
15 * * * * node scripts/cron/send_hourly_alerts.js
```

### **🔍 Monitoreo y Logs:**
- **Logs de captura**: Estadísticas de datos obtenidos
- **Logs de alertas**: Usuarios notificados y errores
- **Métricas**: Tasa de éxito de envíos
- **Errores**: Fallos de API, conexión, email

---

## 🚨 **GESTIÓN DE ERRORES**

### **🔧 Escenarios de Error:**

#### **1. Fallo de API AQICN:**
- **Reintentos**: 3 intentos con backoff exponencial
- **Timeout**: 10 segundos por request
- **Fallback**: Mantener último valor conocido

#### **2. Error de Base de Datos:**
- **Transacciones**: Rollback automático en fallos
- **Reconexión**: Pool de conexiones con retry
- **Logging**: Error detallado para debugging

#### **3. Fallo de Email:**
- **Verificación previa**: Test de configuración SMTP
- **Reintentos**: 2 intentos por email
- **Logging**: Registro de fallos para auditoría

### **📊 Monitoreo de Salud:**
```javascript
// Verificación cada hora
const healthCheck = {
  lastDataUpdate: timestamp,
  apiStatus: 'ok' | 'error',
  emailService: 'ok' | 'error',
  databaseConnection: 'ok' | 'error'
};
```

---

## 📈 **MÉTRICAS Y ESTADÍSTICAS**

### **📊 KPIs del Sistema:**
- **Disponibilidad de datos**: % de horas con datos válidos
- **Latencia de alertas**: Tiempo desde medición hasta envío
- **Tasa de entrega**: % de emails enviados exitosamente
- **Usuarios activos**: Suscritos a alertas

### **📋 Reportes Automáticos:**
- **Diario**: Estadísticas de capturas y alertas
- **Semanal**: Tendencias de calidad del aire
- **Mensual**: Métricas de rendimiento del sistema

---

## 🎯 **MEJORES PRÁCTICAS**

### **✅ Recomendaciones:**
1. **Monitoreo continuo**: Verificar logs regularmente
2. **Backup de datos**: Respaldo automático de mediciones
3. **Validación de datos**: Verificar rangos válidos de PM2.5
4. **Optimización de consultas**: Índices en campos frecuentes
5. **Gestión de memoria**: Pool de conexiones limitado

### **⚠️ Precauciones:**
- **Rate limiting**: Respetar límites de API AQICN
- **Spam prevention**: Máximo 1 alerta por día por usuario
- **Data validation**: Verificar valores antes de almacenar
- **Error handling**: Fallos graceful sin interrumpir servicio

---

## 🔄 **FLUJO COMPLETO RESUMIDO**

```
🕐 CADA HORA:
├── 1. Cron ejecuta cron_update.js
├── 2. Llama a API AQICN (estación 6699)
├── 3. Almacena datos en mediciones_api
├── 4. Cron ejecuta send_hourly_alerts.js
├── 5. Verifica si PM2.5 > 50 µg/m³
├── 6. Si hay alerta: envía emails a usuarios
└── 7. Frontend actualiza visualización

🌐 TIEMPO REAL:
├── Frontend consulta /api/air/constitucion/actual
├── Muestra datos en AirQualityCard
├── Actualiza cada 5 minutos
└── Código de colores según estado OMS
```

---

## 📚 **ARCHIVOS RELACIONADOS**

### **🔧 Scripts de Cron:**
- `scripts/cron/cron_update.js` - Actualización horaria
- `scripts/cron/send_hourly_alerts.js` - Alertas automáticas

### **🌐 Servicios:**
- `src/services/api_aqicn.js` - Integración con AQICN
- `src/services/email_service.js` - Envío de emails

### **📡 API Routes:**
- `src/routes/air.js` - Endpoints de calidad del aire

### **⚛️ Frontend:**
- `frontend/src/components/AirQualityCard.jsx` - Visualización
- `frontend/src/components/UserDashboard.jsx` - Configuración

### **🗄️ Base de Datos:**
- `src/database/db.js` - Funciones de acceso a datos
- Tabla: `mediciones_api` - Datos horarios
- Tabla: `notificaciones_enviadas` - Log de alertas

---

**📝 Documento actualizado**: 17 de junio de 2025  
**👨‍💻 Sistema**: Air Gijón - Monitoreo de Calidad del Aire  
**🎯 Objetivo**: Documentación completa del proceso de visualización horaria 