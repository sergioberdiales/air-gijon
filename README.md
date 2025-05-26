# Air-Gijón

Air-Gijón es una aplicación web para la consulta y predicción de la calidad del aire en Gijón, centrada en la estación de la Avenida Constitución. Permite visualizar datos actuales de contaminantes (como PM10) y mantiene un historial completo para análisis temporales y modelos predictivos.

## Características principales
- Consulta de datos actuales de calidad del aire (PM10, NO2, etc.)
- **Sistema de datos históricos** para análisis temporales y predicciones
- Backend en Node.js con Express y PostgreSQL optimizado
- Integración con la API internacional AQICN
- Base de datos optimizada para consultas históricas
- Actualización automática cada 6 horas
- Scripts de gestión y monitoreo

## Instalación y ejecución

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/sergioberdiales/air-gijon.git
   cd air-gijon
   ```

2. **Instala las dependencias:**
   ```bash
   npm install
   ```

3. **Configura las variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido (ajusta los valores según tu entorno):
   ```env
   DATABASE_URL=postgresql://usuario:contraseña@localhost/air_gijon
   AQICN_TOKEN=tu_token_de_aqicn
   DB_USER=usuario
   DB_HOST=localhost
   DB_NAME=air_gijon
   DB_PASSWORD=contraseña
   DB_PORT=5432
   ```

4. **Ejecuta el backend:**
   ```bash
   node server.js
   ```
   El servidor escuchará por defecto en `http://localhost:3000`.

## Scripts disponibles

- `npm start`: Ejecutar el servidor en producción
- `npm run dev`: Ejecutar en modo desarrollo con nodemon
- `npm run update-aqicn`: Actualizar datos históricos de AQICN
- `npm run stats`: Ver estadísticas de datos históricos
- `npm run check-env`: Verificar configuración de variables de entorno
- `npm run test-db`: Probar conexión a base de datos

## Documentación de la API

### Obtener el valor actual de PM10 (Avenida Constitución)

**Endpoint:**
```
GET /api/air/constitucion/pm10
```

**Respuesta exitosa (`200 OK`):**
```json
{
  "estacion": "Avenida Constitución",
  "fecha": "2025-04-25T15:00:00.000Z",
  "pm10": 21,
  "estado": "Buena"
}
```
- **estacion**: Nombre de la estación.
- **fecha**: Fecha y hora de la medición (ISO).
- **pm10**: Valor de PM10 en µg/m³.
- **estado**: Estado de la calidad del aire según el valor de PM10 (`Buena`, `Moderada`, `Regular`, `Mala`).

**Respuesta si no hay datos (`404 Not Found`):**
```json
{ "error": "No hay datos disponibles" }
```

**Respuesta de error interno (`500 Internal Server Error`):**
```json
{ "error": "Error consultando la base de datos" }
```

## Sistema de Datos Históricos

### Características del Sistema

Air-Gijón implementa un **sistema avanzado de gestión de datos históricos** que:

- **Acumula datos** en lugar de eliminarlos para permitir análisis temporales
- **Detecta y actualiza duplicados** automáticamente
- **Optimiza el rendimiento** con índices específicos para consultas históricas
- **Limpia datos antiguos** (>30 días) automáticamente para mantener la eficiencia
- **Proporciona estadísticas** detalladas del historial de datos

### Estructura de Base de Datos

#### Tabla `mediciones_api`
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
```

#### Índices Optimizados
- `idx_mediciones_api_estacion_fecha`: Para consultas por estación y fecha
- `idx_mediciones_api_parametro_fecha`: Para consultas por parámetro específico
- `idx_mediciones_api_fecha`: Para consultas temporales generales
- `idx_mediciones_api_created_at`: Para limpieza de datos antiguos

### Parámetros Almacenados

El sistema almacena los siguientes parámetros de calidad del aire:
- **PM10** y **PM2.5**: Partículas en suspensión
- **NO2**: Dióxido de nitrógeno
- **SO2**: Dióxido de azufre
- **O3**: Ozono
- **Variables meteorológicas**: Temperatura, humedad, presión, viento

## Automatización y Cron Job

### Configuración del Cron Job en Render

- **Nombre del job:** `update-aqicn`
- **Comando ejecutado:** `npm run update-aqicn`
- **Frecuencia recomendada:** `0 */6 * * *` (cada 6 horas)
- **Variables de entorno requeridas:**
  ```env
  DATABASE_URL=postgresql://...  # URL de PostgreSQL en Render
  NODE_ENV=production
  ```

### Proceso de Actualización

El cron job ejecuta el siguiente flujo optimizado:

1. **📊 Estadísticas iniciales**: Muestra el estado actual de la base de datos
2. **🧹 Limpieza inteligente**: Elimina solo datos antiguos (>30 días)
3. **📥 Obtención de datos**: Consulta la API AQICN con reintentos automáticos
4. **💾 Almacenamiento inteligente**: Detecta duplicados y actualiza/inserta según corresponda
5. **📊 Estadísticas finales**: Confirma el crecimiento del historial

### Logs del Sistema

Ejemplo de logs exitosos:
```
🚀 Iniciando actualización de datos AQICN...
📊 Estadísticas actuales: 150 registros, 15 días con datos
🧹 Limpiando datos antiguos: 0 registros eliminados
📥 Obteniendo datos de la API...
💾 Almacenando datos: Nuevos datos insertados
📊 Estadísticas finales: 160 registros, 16 días con datos
✅ Actualización completada exitosamente
```

## Ventajas del Sistema Histórico

### Para Análisis y Predicciones
- **Tendencias temporales**: Identificación de patrones de contaminación
- **Análisis estacional**: Variaciones por época del año
- **Correlaciones**: Relación entre diferentes parámetros ambientales
- **Machine Learning**: Base sólida para modelos predictivos

### Para Rendimiento
- **Consultas optimizadas**: Índices específicos para análisis temporal
- **Escalabilidad**: Preparado para grandes volúmenes de datos
- **Mantenimiento automático**: Limpieza de datos antiguos
- **Integridad garantizada**: Prevención de duplicados y corrupción

## Solución de Problemas

### Verificación del Sistema

1. **Verificar configuración:**
   ```bash
   npm run check-env
   ```

2. **Probar conexión a base de datos:**
   ```bash
   npm run test-db
   ```

3. **Ver estadísticas de datos:**
   ```bash
   npm run stats
   ```

4. **Ejecutar actualización manual:**
   ```bash
   npm run update-aqicn
   ```

### Problemas Comunes

- **Error ECONNREFUSED**: Verificar que `DATABASE_URL` esté configurada en Render
- **Datos no actualizados**: Revisar logs del cron job en Render Dashboard
- **Duplicados**: El sistema los maneja automáticamente con constraints UNIQUE

## Documentación Adicional

- **`render-cron-config.md`**: Guía completa de configuración en Render
- **`memoria_proyecto_air_gijon.md`**: Documentación técnica detallada
- **Código fuente**: Comentado y documentado en el repositorio

## Créditos
- Sergio Berdiales
- Basado en datos de AQICN y Ayuntamiento de Gijón

## Licencia
MIT 