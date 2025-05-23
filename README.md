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