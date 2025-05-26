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

La tabla `mediciones_api` tiene la siguiente estructura:
```sql
CREATE TABLE mediciones_api (
    id SERIAL PRIMARY KEY,
    estacion_id VARCHAR(50),
    fecha TIMESTAMP WITH TIME ZONE,
    parametro VARCHAR(50),
    valor DECIMAL(10,2),
    aqi INTEGER,
    is_validated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Logs Esperados

Un cron job exitoso debe mostrar logs similares a:
```
🚀 Iniciando actualización de datos AQICN...
NODE_ENV: production
DATABASE_URL configurada: Sí
🔍 Verificando conexión a la base de datos...
✅ Conexión a PostgreSQL exitosa: [timestamp]
🗑️ Limpiando tabla mediciones_api...
✅ Tabla mediciones_api limpiada correctamente
📥 Obteniendo datos de la API...
📊 Datos obtenidos:
Timestamp: [timestamp]
AQI: [valor]
Hora de medición: [timestamp]
💾 Almacenando datos en la base de datos...
✅ Datos almacenados correctamente para X parámetros
✅ Datos de AQICN actualizados correctamente
🔌 Conexión a la base de datos cerrada
``` 