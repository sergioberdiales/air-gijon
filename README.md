# Air-Gijón

Air-Gijón es una aplicación web para la consulta y predicción de la calidad del aire en Gijón, centrada en la estación de la Avenida Constitución. Permite visualizar datos actuales de contaminantes (como PM10) y servirá de base para modelos predictivos y notificaciones a la ciudadanía.

## Características principales
- Consulta de datos actuales de calidad del aire (PM10, NO2, etc.)
- Backend en Node.js con Express y PostgreSQL
- Integración con la API internacional AQICN
- Preparado para visualización y predicción

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

## Créditos
- Sergio Berdiales
- Basado en datos de AQICN y Ayuntamiento de Gijón

## Licencia
MIT 

## Automatización de la actualización de datos (Cron Job)

Para mantener los datos de calidad del aire siempre actualizados, se ha configurado un cron job en Render llamado `update-aqicn`. Este job ejecuta periódicamente un script que descarga los datos de la API internacional AQICN y los almacena en la base de datos PostgreSQL.

### Configuración del Cron Job

- **Nombre del job:** `update-aqicn`
- **Comando ejecutado:** `npm run update-aqicn`
- **Frecuencia:** cada hora (configurable con expresión cron)
- **Directorio de trabajo:** `/opt/render/project/src`

### Script y Funcionalidad

El script `update_aqicn.js` realiza las siguientes operaciones:

1. Limpia la tabla `mediciones_api` para evitar duplicados
2. Obtiene datos actualizados de la API AQICN para la estación 6699 (Avenida Constitución)
3. Almacena los siguientes parámetros en la base de datos:
   - PM10 y PM2.5 (partículas en suspensión)
   - NO2 (dióxido de nitrógeno)
   - O3 (ozono)
   - SO2 (dióxido de azufre)
   - Temperatura, humedad, presión y viento

### Variables de Entorno Requeridas

En el panel de Render, configurar las siguientes variables:

```env
DATABASE_URL=postgresql://...  # Internal Database URL de Render
NODE_ENV=production
AQICN_TOKEN=tu_token_de_aqicn
```

### Estructura del Código

El sistema está compuesto por dos archivos principales:

1. **`update_aqicn.js`**: Script principal que orquesta el proceso
   ```js
   const { getAirQualityData, storeAirQualityData, cleanMedicionesApi } = require('./api_aqicn');
   ```

2. **`api_aqicn.js`**: Módulo con las funciones de obtención y almacenamiento de datos
   ```js
   module.exports = {
     getAirQualityData,
     storeAirQualityData,
     cleanMedicionesApi
   };
   ```

### Logs y Monitoreo

El script genera logs detallados en cada paso:
- 🗑️ Limpieza de la tabla
- 📥 Obtención de datos
- 📊 Visualización de datos obtenidos
- 💾 Almacenamiento en base de datos
- ✅ Confirmación de actualización exitosa

### Solución de Problemas

Si el cron job falla, verificar:

1. **Variables de entorno**: Asegurarse de que están correctamente configuradas en Render
2. **Conexión a la base de datos**: Verificar que la URL de conexión es correcta
3. **Token de AQICN**: Confirmar que el token es válido y tiene permisos
4. **Logs en Render**: Revisar los logs del cron job para identificar errores específicos

### Mantenimiento

- El script está diseñado para ser robusto y manejar errores
- Incluye reintentos automáticos en caso de fallos de red
- Cierra correctamente las conexiones a la base de datos
- Limpia la tabla antes de cada actualización para evitar duplicados

Para más detalles sobre la implementación, consultar el código fuente en el repositorio. 