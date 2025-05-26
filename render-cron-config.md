# Configuración del Cron Job en Render

## Variables de Entorno Requeridas

El cron job **DEBE** tener acceso a las siguientes variables de entorno:

### 1. DATABASE_URL
- **Descripción**: URL de conexión a PostgreSQL
- **Formato**: `postgresql://usuario:password@host:puerto/database`
- **Ejemplo**: `postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com:5432/airgijon_db`
- **Crítico**: Sin esta variable, el cron job fallará con error ECONNREFUSED

### 2. NODE_ENV
- **Descripción**: Entorno de ejecución
- **Valor**: `production`
- **Propósito**: Evita cargar dotenv en producción

## Configuración del Cron Job

### Comando del Cron Job
```bash
npm run update-aqicn
```

### Frecuencia Recomendada
```
0 */6 * * *
```
(Cada 6 horas)

### Scripts de Verificación

#### Verificar Variables de Entorno
```bash
npm run check-env
```

#### Probar Conexión a Base de Datos
```bash
npm run test-db
```

## Sistema de Datos Históricos

### 🔄 **Nuevo Comportamiento**
- **Acumulación**: Los datos se acumulan en lugar de eliminarse
- **Detección de duplicados**: Si ya existen datos para una fecha, se actualizan
- **Limpieza automática**: Solo se eliminan datos antiguos (>30 días)
- **Optimización**: Índices creados para consultas históricas eficientes

### 📊 **Estructura de Datos**
Cada ejecución del cron job:
1. Muestra estadísticas actuales de la base de datos
2. Limpia datos antiguos (>30 días) para optimización
3. Obtiene nuevos datos de la API AQICN
4. Verifica si ya existen datos para esa fecha/hora
5. Inserta nuevos datos o actualiza existentes
6. Muestra estadísticas finales

## Solución de Problemas

### Error: ECONNREFUSED ::1:5432 o 127.0.0.1:5432
**Causa**: DATABASE_URL no está configurada o apunta a localhost
**Solución**: 
1. Verificar que DATABASE_URL esté configurada en las variables de entorno del cron job
2. Asegurarse de que la URL apunte al servidor PostgreSQL de Render, no a localhost

### Error: DATABASE_URL no está configurada
**Causa**: La variable de entorno no está disponible en el contexto del cron job
**Solución**:
1. Ir a Render Dashboard → Cron Jobs → [Tu Cron Job] → Environment
2. Añadir DATABASE_URL con el valor correcto
3. Reiniciar el cron job

### Verificación Manual
Para verificar que todo funciona correctamente:

1. **Ejecutar verificación de entorno**:
   ```bash
   npm run check-env
   ```

2. **Ejecutar actualización manual**:
   ```bash
   npm run update-aqicn
   ```

3. **Verificar logs del cron job** en Render Dashboard

## Estructura de la Base de Datos

La tabla `mediciones_api` tiene la siguiente estructura optimizada:
```sql
CREATE TABLE mediciones_api (
    id SERIAL PRIMARY KEY,
    estacion_id VARCHAR(50) NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    parametro VARCHAR(50) NOT NULL,
    valor DECIMAL(10,2),
    aqi INTEGER,
    is_validated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(estacion_id, fecha, parametro)
);

-- Índices para consultas históricas optimizadas
CREATE INDEX idx_mediciones_api_estacion_fecha ON mediciones_api(estacion_id, fecha DESC);
CREATE INDEX idx_mediciones_api_parametro_fecha ON mediciones_api(parametro, fecha DESC);
CREATE INDEX idx_mediciones_api_fecha ON mediciones_api(fecha DESC);
CREATE INDEX idx_mediciones_api_created_at ON mediciones_api(created_at);
```

## Logs Esperados

Un cron job exitoso debe mostrar logs similares a:
```
🚀 Iniciando actualización de datos AQICN...
NODE_ENV: production
DATABASE_URL configurada: Sí
🔍 Verificando conexión a la base de datos...
✅ Conexión a PostgreSQL exitosa: [timestamp]
📊 Estadísticas actuales de la base de datos:
   • Total registros: X
   • Estaciones: Y
   • Días con datos: Z
   • Fecha más antigua: [fecha]
   • Fecha más reciente: [fecha]
🧹 Limpiando datos antiguos (>30 días)...
   • Eliminados N registros antiguos (o "No hay datos antiguos para eliminar")
📥 Obteniendo datos de la API...
📊 Datos obtenidos:
💾 Almacenando datos en la base de datos...
ℹ️ Los datos para [fecha] ya existen, actualizando... (o "📝 Insertando nuevos datos...")
✅ Datos actualizados/almacenados correctamente para X parámetros
📊 Estadísticas finales:
   • Total registros: X
   • Días con datos: Z
   • Fecha más reciente: [fecha]
✅ Datos de AQICN actualizados correctamente
🔌 Conexión a la base de datos cerrada
```

## Ventajas del Nuevo Sistema

### 🎯 **Para Análisis y Predicciones**
- **Datos históricos**: Acumulación de datos para análisis temporales
- **Tendencias**: Posibilidad de identificar patrones y tendencias
- **Predicciones**: Base de datos para modelos de machine learning
- **Comparaciones**: Análisis de calidad del aire a lo largo del tiempo

### ⚡ **Para Rendimiento**
- **Índices optimizados**: Consultas históricas rápidas
- **Limpieza automática**: Mantiene la tabla optimizada
- **Sin duplicados**: Constraint UNIQUE evita datos redundantes
- **Actualizaciones inteligentes**: Solo actualiza cuando es necesario 