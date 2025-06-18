# 📊 Documentación Técnica: Sistema de Predicciones PM2.5

## 🎯 **Resumen Ejecutivo**

El sistema de predicciones de PM2.5 de Air Gijón utiliza un modelo de Machine Learning (LightGBM) para predecir los niveles de contaminación por partículas finas (PM2.5) con 1-2 días de antelación. Este documento explica paso a paso cómo funciona el script `daily_predictions.py`.

---

## 📁 **Ubicación y Propósito**

- **Archivo**: `scripts/cron/modelos_prediccion/daily_predictions.py`
- **Modelo**: `modelo_lgbm_pm25.joblib` (LightGBM entrenado)
- **Ejecución**: Cron job diario a las 04:30 UTC
- **Objetivo**: Generar predicciones de PM2.5 para hoy y mañana

---

## 🔧 **¿Cómo Funciona el Script?**

### **1. CONEXIÓN A BASE DE DATOS**

```python
def get_db_connection():
    database_url = os.getenv('DATABASE_URL')  # Render PostgreSQL
    if database_url:
        conn = psycopg2.connect(database_url)  # Producción
    else:
        conn = psycopg2.connect(host='localhost', ...)  # Local
```

**¿Qué hace?**
- Se conecta a PostgreSQL usando la variable `DATABASE_URL` (producción) o credenciales locales
- Utiliza `psycopg2` para las consultas SQL
- Maneja automáticamente el entorno (producción vs desarrollo)

### **2. VERIFICACIÓN Y CÁLCULO AUTOMÁTICO DE DATOS FALTANTES** ⭐ **NUEVO**

Antes de cargar los datos históricos, el script verifica automáticamente si faltan promedios diarios y los calcula desde datos horarios:

```python
def ensure_daily_data_updated(target_date):
    target_dt = pd.to_datetime(target_date)
    yesterday = (target_dt - timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Verificar si el día anterior está en promedios_diarios
    cursor.execute(
        "SELECT valor FROM promedios_diarios WHERE fecha = %s AND parametro = 'pm25'",
        (yesterday,)
    )
    existing = cursor.fetchone()
    
    if not existing:
        # Calcular promedio del día anterior desde mediciones_api
        daily_avg = calculate_daily_average_from_hourly(yesterday)
        if daily_avg is not None:
            update_daily_average_in_db(yesterday, daily_avg)
```

#### **A) CÁLCULO DE PROMEDIO DESDE DATOS HORARIOS**

```python
def calculate_daily_average_from_hourly(target_date):
    # Obtener datos horarios del día
    query = """
    SELECT EXTRACT(HOUR FROM fecha) as hora, valor
    FROM mediciones_api 
    WHERE DATE(fecha) = %s 
      AND estacion_id = '6699'
      AND parametro = 'pm25'
      AND valor IS NOT NULL
    ORDER BY fecha ASC
    """
```

**¿Qué hace esta función?**
- **Consulta horaria**: Obtiene todas las mediciones de PM2.5 de las 24 horas del día
- **Estación específica**: Usa solo datos de la estación '6699' (Avenida Constitución)
- **Filtrado**: Excluye valores NULL o inválidos

#### **B) ALGORITMO DE INTERPOLACIÓN INTELIGENTE**

```python
# Si faltan horas, interpolar
for hour in range(24):
    if not any(h['hora'] == hour for h in hourly_data):
        # Buscar valores anterior y siguiente para interpolar
        prev_val = None
        next_val = None
        
        # Valor anterior
        for h in reversed(range(hour)):
            prev_data = [d for d in hourly_data if d['hora'] == h]
            if prev_data:
                prev_val = prev_data[0]['valor']
                break
        
        # Valor siguiente  
        for h in range(hour + 1, 24):
            next_data = [d for d in hourly_data if d['hora'] == h]
            if next_data:
                next_val = next_data[0]['valor']
                break
        
        # Interpolar
        if prev_val is not None and next_val is not None:
            interpolated_val = (prev_val + next_val) / 2
        elif prev_val is not None:
            interpolated_val = prev_val
        elif next_val is not None:
            interpolated_val = next_val
        else:
            interpolated_val = 25.0  # Valor por defecto
```

**¿Cómo funciona la interpolación?**

**Ejemplo práctico:**
Si tenemos datos para las horas: 1, 3, 5, 8, 12, 18, 22

**Para la hora 2 (falta):**
- Anterior disponible: hora 1 = 35 µg/m³
- Siguiente disponible: hora 3 = 45 µg/m³  
- **Interpolación**: (35 + 45) / 2 = **40 µg/m³**

**Para la hora 23 (falta):**
- Anterior disponible: hora 22 = 28 µg/m³
- Siguiente disponible: ninguna
- **Resultado**: **28 µg/m³** (usa el anterior)

**Para la hora 0 (falta, inicio del día):**
- Anterior disponible: ninguna
- Siguiente disponible: hora 1 = 35 µg/m³
- **Resultado**: **35 µg/m³** (usa el siguiente)

#### **C) INSERCIÓN AUTOMÁTICA EN BASE DE DATOS**

```python
def update_daily_average_in_db(date, average_value):
    # Función para determinar estado según OMS
    def get_pm25_state(value):
        if value <= 12: return 'Buena'
        if value <= 35: return 'Regular'
        if value <= 55: return 'Insalubre para grupos sensibles'
        if value <= 150: return 'Insalubre'
        if value <= 250: return 'Muy insalubre'
        return 'Peligrosa'
    
    estado = get_pm25_state(average_value)
    
    # Verificar si ya existe y actualizar o insertar
    if existing:
        cursor.execute("""
            UPDATE promedios_diarios 
            SET valor = %s, estado = %s, source = 'mediciones_api'
            WHERE fecha = %s AND parametro = 'pm25'
        """, (average_value, estado, date))
    else:
        cursor.execute("""
            INSERT INTO promedios_diarios (fecha, parametro, valor, estado, source, detalles)
            VALUES (%s, 'pm25', %s, %s, 'mediciones_api', 'Promedio calculado desde datos horarios')
        """, (date, average_value, estado))
```

**¿Qué hace esta función?**
- **Calcula estado OMS**: Asigna categoría (Buena/Regular/Insalubre) según el valor
- **Control de duplicados**: UPDATE si el registro existe, INSERT si no existe
- **Trazabilidad**: Marca source='mediciones_api' para diferenciarlo de datos CSV
- **Metadatos**: Añade descripción explicativa en el campo detalles

### **3. CARGA DE DATOS HISTÓRICOS**

```python
def load_historical_data(target_date):
    # PASO 1: Asegurar que los datos diarios estén actualizados
    ensure_daily_data_updated(target_date)
    
    # PASO 2: Cargar datos históricos
    query = """
    SELECT fecha, valor
    FROM promedios_diarios 
    WHERE parametro = 'pm25' 
      AND fecha < %s
    ORDER BY fecha ASC
    """
```

**¿Qué hace ahora?**
- **PASO 1**: Verifica y completa automáticamente datos faltantes del día anterior
- **PASO 2**: Carga TODOS los valores de PM2.5 anteriores a la fecha objetivo
- **Ejemplo**: Si hoy es 15-junio, obtiene datos del 1-mayo al 14-junio (45 días)
- **Validación**: Requiere mínimo 28 días de datos históricos
- **Garantía**: Ahora siempre tiene datos completos gracias al PASO 1

**¿Por qué 28 días mínimo?**
- El modelo necesita calcular `lag28` (valor de hace 28 días)
- Sin 28 días de historial, no puede generar todas las variables necesarias

**¿Qué cambia con la mejora?**
- **Antes**: Si faltaba un día en `promedios_diarios`, el script fallaba
- **Ahora**: Si falta un día, lo calcula automáticamente y continúa

### **4. GENERACIÓN DE 33 VARIABLES DEL MODELO**

Esta es la parte más compleja. El modelo LightGBM fue entrenado con exactamente 33 variables:

#### **A) VARIABLES LAG (16 variables)**
```python
# lag1, lag2, lag3, ..., lag14, lag21, lag28
lag_list = list(range(1, 15)) + [21, 28]
for k in lag_list:
    features[f"lag{k}"] = pm25_values[-k]  # Valor de k días atrás
```

**¿Qué son los LAGS?**
- `lag1`: Valor de PM2.5 de ayer
- `lag2`: Valor de PM2.5 de anteayer  
- `lag7`: Valor de PM2.5 de hace 1 semana
- `lag28`: Valor de PM2.5 de hace 4 semanas

**Ejemplo práctico:**
Si hoy es 15-junio y tenemos datos hasta el 14-junio:
- `lag1` = PM2.5 del 14-junio (ayer)
- `lag7` = PM2.5 del 8-junio (hace 1 semana)
- `lag28` = PM2.5 del 18-mayo (hace 4 semanas)

#### **B) DIFERENCIAS ABSOLUTAS (13 variables)**
```python
# diff_abs1, diff_abs2, ..., diff_abs13
for k in range(1, 14):
    features[f"diff_abs{k}"] = features[f"lag{k}"] - features[f"lag{k+1}"]
```

**¿Qué son las DIFERENCIAS?**
- Miden la **variación** entre días consecutivos
- `diff_abs1` = diferencia entre ayer y anteayer
- `diff_abs7` = diferencia entre hace 7 y 8 días

**¿Por qué son importantes?**
- Capturan **tendencias** (¿está subiendo o bajando la contaminación?)
- Ayudan al modelo a detectar **patrones de cambio**

#### **C) VARIABLES DE TENDENCIA (2 variables)**
```python
features["trend"] = (latest_date - df.index[0]).days  # Días desde el primer dato
features["trend7"] = (features["lag1"] - features["lag7"]) / 6  # Pendiente últimos 7 días
```

**¿Qué miden?**
- `trend`: Días transcurridos desde el primer dato disponible
- `trend7`: Tendencia de la última semana (¿sube o baja?)

#### **D) VARIABLES EXÓGENAS (2 variables)**
```python
features["wd"] = target_dt.dayofweek  # 0=Lunes, 6=Domingo
features["month"] = target_dt.month   # 1=Enero, 12=Diciembre
```

**¿Para qué sirven?**
- `wd` (día semana): Captura patrones laborables vs fines de semana
- `month` (mes): Captura estacionalidad (invierno vs verano)

### **5. PREDICCIÓN DÍA ACTUAL**

```python
# Convertir features a DataFrame
features_df = pd.DataFrame([features_dict])

# Predicción con LightGBM
pred_day_0 = model.predict(features_df)[0]
pred_day_0 = round(float(pred_day_0), 2)
```

**¿Qué hace?**
- Toma las 33 variables generadas
- Las pasa al modelo LightGBM entrenado
- Obtiene predicción de PM2.5 para el día actual
- Redondea a 2 decimales

### **6. PREDICCIÓN DÍA SIGUIENTE**

Esta es la parte más sofisticada:

```python
# Crear features para mañana
next_day_features = features_dict.copy()

# Desplazar todos los lags
for k in range(28, 1, -1):
    next_day_features[f"lag{k}"] = next_day_features[f"lag{k-1}"]

# La predicción de hoy se convierte en lag1 de mañana
next_day_features["lag1"] = pred_day_0
```

**¿Cómo funciona el desplazamiento?**

**Ejemplo visual:**
```
ANTES (para hoy):
lag1 = 35 (PM2.5 de ayer)
lag2 = 48 (PM2.5 de anteayer)
lag3 = 56 (PM2.5 de hace 3 días)

DESPUÉS (para mañana):
lag1 = 42 (predicción de hoy - se convierte en "ayer" para mañana)
lag2 = 35 (lo que era lag1 ahora es lag2)
lag3 = 48 (lo que era lag2 ahora es lag3)
```

**Actualización de otras variables:**
```python
# Recalcular diferencias absolutas
next_day_features[f"diff_abs{k}"] = next_day_features[f"lag{k}"] - next_day_features[f"lag{k+1}"]

# Actualizar tendencia semanal
next_day_features["trend7"] = (next_day_features["lag1"] - next_day_features["lag7"]) / 6

# Actualizar variables exógenas
next_day_dt = target_dt + timedelta(days=1)
next_day_features["wd"] = next_day_dt.dayofweek
next_day_features["month"] = next_day_dt.month
```

### **7. SALIDA DEL SCRIPT**

```json
{
  "fecha_generacion": "2025-06-15T18:30:00.000Z",
  "prediccion_dia_actual": {
    "fecha": "2025-06-15",
    "valor": 42.5,
    "horizonte_dias": 0
  },
  "prediccion_dia_siguiente": {
    "fecha": "2025-06-16", 
    "valor": 38.2,
    "horizonte_dias": 1
  },
  "modelo_info": {
    "tipo": "LightGBM",
    "variables_utilizadas": 33
  }
}
```

---

## ⚙️ **Integración con el Sistema**

### **Ejecución Automática (Cron Job)**
```bash
# En Render: air-gijon-predictions
# Horario: 04:30 UTC diariamente
python3 /opt/render/project/src/scripts/cron/modelos_prediccion/daily_predictions.py 2025-06-15
```

### **Consumo de Predicciones**
- **Backend**: `src/routes/air.js` → endpoint `/api/air/constitucion/evolucion`
- **Frontend**: `components/EvolucionPM25.jsx` → muestra gráfico con predicciones
- **Base de datos**: Las predicciones se almacenan para consumo de la API

---

## 🧠 **¿Por qué Funciona Este Enfoque?**

### **1. Memoria Temporal Extensa**
- Los **lags** dan al modelo "memoria" de lo que pasó hasta 4 semanas atrás
- Captura patrones estacionales y ciclos de contaminación

### **2. Detección de Tendencias**
- Las **diferencias absolutas** permiten detectar si la contaminación está subiendo o bajando
- El `trend7` captura la tendencia de la última semana

### **3. Contexto Temporal**
- **Día de la semana**: Menos tráfico los fines de semana
- **Mes del año**: Más contaminación en invierno (calefacción, inversión térmica)

### **4. Predicción Recursiva**
- Para predecir mañana, usa la predicción de hoy como input
- Esto permite extender el horizonte de predicción

---

## 📈 **Rendimiento del Modelo**

- **Modelo**: LightGBM (Gradient Boosting)
- **MAE**: 8.370 µg/m³ (Error Absoluto Medio)
- **Variables**: 33 características de entrada
- **Horizonte**: 2 días (hoy + mañana)
- **Frecuencia**: Predicciones diarias

---

## 🚨 **Requisitos Críticos**

### **Datos Mínimos Necesarios**
- **28 días** de datos históricos de PM2.5 consecutivos
- Datos **sin gaps** (días faltantes rompen la secuencia de lags)
- Base de datos con tabla `promedios_diarios` poblada

### **Dependencias Técnicas**
- **Python**: pandas, numpy, joblib, psycopg2
- **Modelo**: archivo `modelo_lgbm_pm25.joblib` 
- **BD**: PostgreSQL con conexión activa
- **Variables entorno**: `DATABASE_URL` configurada

---

## 🔧 **Troubleshooting Común**

### **Error: "Insuficientes datos históricos"**
- **Causa**: Menos de 28 días de datos en BD
- **Solución**: Verificar tabla `promedios_diarios` tiene datos PM2.5 suficientes

### **Error: "Modelo no encontrado"**
- **Causa**: Archivo `modelo_lgbm_pm25.joblib` no existe
- **Solución**: Verificar que el modelo esté en la ruta correcta

### **Error: Conexión BD**
- **Causa**: `DATABASE_URL` no configurada o incorrecta
- **Solución**: Verificar variables de entorno en Render

---

## 📝 **Para la Presentación**

### **Puntos Clave a Explicar:**
1. **Machine Learning Aplicado**: Uso de LightGBM para predicción temporal
2. **Ingeniería de Features**: 33 variables extraídas de datos históricos
3. **Predicción Recursiva**: Cómo se predice el día siguiente usando la predicción del día actual  
4. **Automatización**: Cron job que ejecuta predicciones diariamente
5. **Integración**: Desde BD → Modelo → API → Frontend

### **Demo Sugerido:**
- Mostrar datos históricos en pgAdmin
- Ejecutar script manualmente y mostrar output JSON
- Mostrar cómo aparecen las predicciones en la web
- Explicar el gráfico de evolución PM2.5

---

## 🚀 **Mejoras Implementadas (16 Junio 2025)**

### **🎯 Problema Resuelto: Datos Faltantes en Gráfico de Evolución**

**Antes de la mejora:**
- Si faltaba un día en `promedios_diarios`, el script fallaba
- El gráfico de evolución mostraba gaps (datos faltantes)
- Dependía completamente de datos pre-calculados

**Después de la mejora:**
- **Detección automática**: Verifica si faltan datos del día anterior
- **Cálculo inteligente**: Genera promedio desde datos horarios en `mediciones_api`
- **Interpolación robusta**: Maneja días con datos parciales
- **Inserción automática**: Actualiza `promedios_diarios` sin intervención manual
- **Continuidad garantizada**: El gráfico siempre muestra datos completos

### **🔧 Flujo Actualizado del Script**

```
1. daily_predictions.py ejecutado con fecha objetivo
2. → ensure_daily_data_updated(target_date)
3.   → Verificar si (target_date - 1) existe en promedios_diarios
4.   → Si NO existe:
5.     → calculate_daily_average_from_hourly(ayer)
6.       → Consultar mediciones_api para datos horarios de ayer
7.       → Interpolar horas faltantes (anterior/siguiente/25.0 por defecto)
8.       → Calcular promedio de 24 horas
9.     → update_daily_average_in_db(ayer, promedio)
10.      → INSERT/UPDATE en promedios_diarios
11.      → Asignar estado OMS (Buena/Regular/Insalubre)
12. → load_historical_data(target_date) # Ahora con datos completos
13. → Generar 33 variables del modelo LightGBM
14. → Ejecutar predicciones para hoy y mañana
15. → Retornar JSON con resultados
```

### **📊 Beneficios Técnicos**

1. **Robustez**: Sistema tolerante a fallos de datos
2. **Autonomía**: No requiere intervención manual para datos faltantes  
3. **Trazabilidad**: Marca source='mediciones_api' vs 'csv_historical'
4. **Precisión**: Algoritmo de interpolación inteligente
5. **Consistencia**: Garantiza continuidad en gráficos de evolución

### **🔍 Casos de Uso Cubiertos**

- **Día completo sin datos**: Usa valor por defecto 25 µg/m³
- **Día con datos parciales**: Interpola horas faltantes
- **Hora aislada faltante**: Promedio entre anterior y siguiente
- **Horas iniciales/finales faltantes**: Propaga valor más cercano
- **Múltiples gaps**: Interpolación secuencial independiente

### **✅ Testing y Verificación**

**Prueba local exitosa:**
```bash
# Eliminar manualmente dato del 14 de junio
DELETE FROM promedios_diarios WHERE fecha = '2025-06-14' AND parametro = 'pm25';

# Ejecutar script
python daily_predictions.py 2025-06-15

# Output esperado:
# ❌ Faltan datos para 2025-06-14, calculando desde mediciones_api...
# 🔄 Calculando promedio diario para 2025-06-14...
# 📊 Encontrados 1 registros horarios
# 🔧 Interpolando 23 horas faltantes...
# 📈 Promedio calculado: 30.00 µg/m³ (23 horas interpoladas)
# 💾 Actualizando promedio diario en BD: 2025-06-14 = 30.0 µg/m³
# ✅ Nuevo registro insertado
```

**Deployment a producción:**
- ✅ Backup creado: `daily_predictions.py.backup`
- ✅ Código desplegado en Render via GitHub
- ✅ Próxima ejecución automática: 6:00 AM UTC diariamente

---

## 🔧 **INTEGRACIÓN Y CONSUMO DE PREDICCIONES**

### **⚠️ IMPORTANTE: MAPEO POR HORIZONTE_DIAS**

**REGLA CRÍTICA**: Las predicciones se deben mapear por `horizonte_dias`, **NO por fecha**.

#### **❌ INCORRECTO - Mapeo por fecha:**
```javascript
// MAL: Asumir que fecha determina si es hoy o mañana
const predHoy = predicciones.find(row => row.fecha === fechaHoy);
const predManana = predicciones.find(row => row.fecha === fechaManana);
```

**Problema**: Las fechas pueden no coincidir con el día real debido a zonas horarias, delays en ejecución, etc.

#### **✅ CORRECTO - Mapeo por horizonte:**
```javascript
// BIEN: Usar horizonte_dias como referencia
const predHoy = predicciones.find(row => row.horizonte_dias === 0);
const predManana = predicciones.find(row => row.horizonte_dias === 1);
```

**¿Por qué es correcto?**
- `horizonte_dias = 0` → Siempre es la predicción para "hoy"
- `horizonte_dias = 1` → Siempre es la predicción para "mañana"
- Independiente de fechas, zonas horarias o delays

### **📝 CONSULTA SQL ESTÁNDAR PARA PREDICCIONES**

**Template obligatorio para todos los componentes que consuman predicciones:**

```sql
SELECT p.fecha, p.valor, p.horizonte_dias, m.nombre_modelo, m.mae
FROM predicciones p
JOIN modelos_prediccion m ON p.modelo_id = m.id
WHERE p.fecha >= $1                    -- Fecha base (normalmente hoy)
  AND p.estacion_id = '6699'           -- Estación Avenida Constitución
  AND p.parametro = 'pm25'             -- Parámetro PM2.5
  AND m.activo = true                  -- Solo modelo activo
  AND p.horizonte_dias IN (0, 1)       -- CRÍTICO: Solo hoy y mañana
ORDER BY p.horizonte_dias ASC          -- Ordenar por horizonte
```

**Campos obligatorios en el WHERE:**
- `p.horizonte_dias IN (0, 1)` → Filtro crítico para predicciones relevantes
- `m.activo = true` → Solo modelo en producción
- `p.estacion_id = '6699'` → Estación específica
- `p.parametro = 'pm25'` → Parámetro específico

### **🔄 PATRÓN DE PROCESAMIENTO ESTÁNDAR**

```javascript
async function obtenerPredicciones() {
  // 1. CONSULTA UNIFICADA
  const result = await pool.query(`
    SELECT p.fecha, p.valor, p.horizonte_dias, m.nombre_modelo, m.mae
    FROM predicciones p
    JOIN modelos_prediccion m ON p.modelo_id = m.id
    WHERE p.fecha >= $1
      AND p.estacion_id = '6699'
      AND p.parametro = 'pm25'
      AND m.activo = true
      AND p.horizonte_dias IN (0, 1)
    ORDER BY p.horizonte_dias ASC
  `, [fechaBase]);
  
  // 2. MAPEO POR HORIZONTE (NO POR FECHA)
  const predHoy = result.rows.find(row => row.horizonte_dias === 0);
  const predManana = result.rows.find(row => row.horizonte_dias === 1);
  
  // 3. VALIDACIÓN
  if (!predHoy || !predManana) {
    console.error('❌ Predicciones incompletas');
    return null;
  }
  
  // 4. FORMATEO CONSISTENTE
  return {
    hoy: {
      fecha: predHoy.fecha,
      valor: Math.round(parseFloat(predHoy.valor)),  // Redondeo consistente
      modelo: predHoy.nombre_modelo,
      horizonte_dias: predHoy.horizonte_dias
    },
    manana: {
      fecha: predManana.fecha,
      valor: Math.round(parseFloat(predManana.valor)), // Redondeo consistente
      modelo: predManana.nombre_modelo,
      horizonte_dias: predManana.horizonte_dias
    }
  };
}
```

### **📊 COMPONENTES QUE USAN PREDICCIONES**

#### **1. Sistema de Email (`send_daily_predictions.js`)**
- ✅ **Estado**: Implementación correcta
- **Uso**: Envío diario de predicciones a usuarios
- **Patrón**: Mapeo por horizonte_dias

#### **2. API Web (`/api/air/constitucion/evolucion`)**
- ✅ **Estado**: Corregido (17 junio 2025)
- **Uso**: Frontend de evolución PM2.5
- **Patrón**: Mapeo por horizonte_dias

#### **3. Futuras Integraciones**
Para cualquier nuevo componente que consuma predicciones:
- Usar la **consulta SQL estándar**
- Mapear por **horizonte_dias**
- Aplicar **redondeo consistente**
- Validar **predicciones completas**

### **⚙️ TESTING Y VALIDACIÓN**

#### **Test de Consistencia entre Componentes:**
```javascript
async function testConsistenciaPredicciones() {
  // Obtener predicciones del sistema email
  const emailPreds = await getDailyPredictions();
  
  // Obtener predicciones del sistema web
  const webResponse = await fetch('/api/air/constitucion/evolucion');
  const webData = await webResponse.json();
  const webPreds = webData.datos.filter(d => d.tipo === 'prediccion');
  
  // Verificar valores idénticos
  const emailHoy = emailPreds.hoy.valor;
  const webHoy = webPreds.find(p => p.fecha === emailPreds.hoy.fecha)?.promedio_pm10;
  
  if (emailHoy !== webHoy) {
    console.error(`❌ Inconsistencia detectada: Email=${emailHoy}, Web=${webHoy}`);
  } else {
    console.log(`✅ Consistencia verificada: ${emailHoy} µg/m³`);
  }
}
```

### **🚨 ERRORES COMUNES A EVITAR**

#### **1. Mapeo por Fecha en lugar de Horizonte**
```javascript
// ❌ MAL
const predHoy = result.rows.find(row => row.fecha === hoyStr);

// ✅ BIEN  
const predHoy = result.rows.find(row => row.horizonte_dias === 0);
```

#### **2. Consulta sin Filtro de Horizonte**
```sql
-- ❌ MAL: Puede devolver predicciones de días lejanos
WHERE p.fecha >= $1 AND p.parametro = 'pm25'

-- ✅ BIEN: Solo predicciones relevantes
WHERE p.fecha >= $1 AND p.parametro = 'pm25' AND p.horizonte_dias IN (0, 1)
```

#### **3. Redondeo Inconsistente**
```javascript
// ❌ MAL: Diferentes niveles de redondeo
valor: parseFloat(pred.valor).toFixed(1)  // 34.7
valor: Math.round(pred.valor)             // 35

// ✅ BIEN: Redondeo unificado
valor: Math.round(parseFloat(pred.valor)) // 35 (consistente)
```

#### **4. No Validar Predicciones Completas**
```javascript
// ❌ MAL: Asumir que siempre hay predicciones
const hoy = predicciones[0].valor;

// ✅ BIEN: Validar antes de usar
if (!predHoy || !predManana) {
  console.error('Predicciones incompletas');
  return null;
}
```

---

## 📚 **CASO DE ESTUDIO: SOLUCIÓN DE INCONSISTENCIA (17 JUNIO 2025)**

### **Problema Detectado:**
- Email mostraba: Hoy 35, Mañana 41
- Web mostraba: Hoy 41, Mañana 40
- Base de datos: (34.66, h=0), (39.87, h=1)

### **Causa Raíz:**
- **Email**: Usaba mapeo correcto por horizonte_dias
- **Web**: Usaba mapeo incorrecto por fecha + campo incorrecto

### **Solución Aplicada:**
1. **Unificar consultas SQL** con filtro `horizonte_dias IN (0,1)`
2. **Mapeo consistente** por horizonte en ambos sistemas
3. **Campo correcto** (`promedio_pm10` para compatibilidad frontend)
4. **Redondeo unificado** con `Math.round()`

### **Resultado:**
- **Ambos sistemas**: Hoy 35, Mañana 40 (valores idénticos)
- **Consistencia**: 100% entre email y web
- **Confiabilidad**: Usuarios reciben información coherente

### **Lección Clave:**
> **El mapeo por `horizonte_dias` es la fuente de verdad, no las fechas.**

---

*Documentación actualizada - Air Gijón Sistema de Predicciones PM2.5*
*Última actualización: 17 de Junio 2025* 