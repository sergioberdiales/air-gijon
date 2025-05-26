# Memoria del Proyecto: Air-Gijón

## 1. Descripción general del proyecto

El objetivo de este proyecto es desarrollar una aplicación web a través de la cual cualquier usuario anónimo pueda consultar una predicción a un día vista del nivel de contaminación del aire de la ciudad de Gijón.

En la aplicación, aparte de mostrar predicciones, se podrán consultar mediante visualizaciones de datos niveles presentes y pasados de los niveles de contaminación.

El cliente sería el Ayuntamiento de Gijón, cuya intención sería realizar un proyecto piloto mediante esta aplicación web para analizar la conveniencia o no de realizar una inversión mayor para desarrollar una aplicación más completa y ambiciosa.

## 2. Alcance del sistema

- Se utilizarán exclusivamente datos proporcionados por el Ayuntamiento de Gijón en su portal de transparencia.
- El sistema se centrará en la estación de monitorización de la Avenida de la Constitución.
- Se trabajará con los contaminantes PM10 y NO2.
- Los datos estarán agregados a nivel diario.
- Actualización diaria.
- Enfoque "Mobile First".
- Predicción con algoritmos de aprendizaje automático desarrollados en Python.
- Backend en Node.js, base de datos PostgreSQL.
- Frontend con JavaScript.
- Despliegue en Render.

## 3. Tipología de usuarios

- **Usuarios externos**:
  - *Anónimos*: consultan la información disponible.
  - *Registrados*: se pueden suscribir a notificaciones y alertas.
- **Usuarios internos**:
  - Editan textos de avisos y consejos.
- **Usuarios internos avanzados**:
  - Acceden a históricos y pueden generar informes de seguimiento.

## 4. Restricciones

- Dependencia de la API del Ayuntamiento.
- Solo un desarrollador para todo el proyecto.
- Riesgo asociado a la calidad de las predicciones.
- Exposición pública con posible crítica.
- Posible lentitud al trabajar con administración pública.

## 5. Organización y funciones empresariales

El cliente principal es la Concejalía de Medio Ambiente y Movilidad del Ayuntamiento de Gijón.

## 6. Resultados

Se prevé desarrollar varias vistas para:
- Visualización de niveles de PM10 y NO2 actuales y pasados.
- Predicciones a un día vista.
- Panel de gestión para usuarios internos.
- Panel para suscripción a alertas (usuarios registrados).

## 7. Instalación, registro de dominio y alojamiento web

- Alojamiento en la plataforma Render.
- No se prevé registrar un dominio inicialmente.
- La instalación será automática desde GitHub a Render (CI/CD).

## 8. Analítica web, posicionamiento y promoción

- Se integrará Google Analytics para obtener datos de uso.
- Promoción en redes sociales y mediante nota de prensa del Ayuntamiento.
- Posicionamiento SEO con buenas prácticas en HTML y etiquetas meta.

## 9. Formación y ayuda

- Manual de usuario básico en PDF accesible desde la aplicación.
- FAQ integrada.
- Soporte vía correo electrónico (simulado).

## 10. Planificación temporal

Incluye las siguientes fases:
- Enero: Modelo de datos y base de datos.
- Febrero: Backend y pruebas locales.
- Marzo: Frontend.
- Abril: Integración y despliegue.
- Mayo: Visualizaciones, alertas y pruebas.
- Junio: Documentación final y defensa del proyecto.

## 11. Plazo de entrega

9 de junio de 2025 (convocatoria ordinaria de junio).

## 12. Garantía y soporte

Se ofrece un periodo de soporte y garantía de 3 meses tras la entrega.

## 13. Licencia y propiedad intelectual

El proyecto se entregará bajo licencia MIT, salvo que el cliente especifique otra opción.

## 14. Forma de pago

El desarrollo del proyecto se considera parte del módulo de formación y no está sujeto a pago económico real. En un contexto real, se propondría un presupuesto detallado basado en horas de desarrollo y mantenimiento.

## 15. Modelo de datos

**(Pendiente de desarrollar y documentar en siguientes hitos)**

## 16. Documentación técnica

**(Pendiente de añadir: diagramas de clases, casos de uso, tecnologías aplicadas, valoración personal y bibliografía)**

## 16. Documentación técnica de la API

La aplicación expone un endpoint REST para consultar el valor actual de PM10 en la estación Avenida Constitución, alimentado por la API internacional AQICN.

**Endpoint principal:**
```
GET /api/air/constitucion/pm10
```

**Respuesta de ejemplo:**
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
- **estado**: Estado de la calidad del aire según el valor de PM10.

Para más detalles técnicos y ejemplos de uso, consultar el archivo `README.md` del repositorio.

## 17. Consideraciones de Seguridad: CORS

Durante el desarrollo y despliegue de la aplicación, fue necesario configurar el mecanismo de **CORS (Cross-Origin Resource Sharing)** en el backend.
Esto se debe a que el frontend y el backend están alojados en dominios distintos en Render, lo que provoca que los navegadores bloqueen por defecto las peticiones entre ambos orígenes por motivos de seguridad.

Para permitir que el frontend pueda consumir la API del backend, se configuró el middleware CORS en el servidor Express, permitiendo únicamente el dominio del frontend:

```js
const cors = require('cors');
app.use(cors({
  origin: 'https://air-gijon-front-end.onrender.com'
}));
```

**Referencia:**  
- [MDN Web Docs: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)  
- [Express.js CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)

Esta configuración garantiza la seguridad y el correcto funcionamiento de la aplicación en producción.

## 18. Sistema de Datos Históricos y Automatización (Cron Job)

Para garantizar que la aplicación mantenga un historial completo de datos de calidad del aire para análisis temporales y predicciones, se ha implementado un sistema avanzado de gestión de datos históricos con actualización automática mediante cron job en Render.

### 18.1 Arquitectura del Sistema de Datos Históricos

El sistema está diseñado para **acumular datos históricos** en lugar de eliminarlos, permitiendo:
- Análisis de tendencias temporales
- Desarrollo de modelos predictivos
- Comparaciones históricas
- Visualizaciones de evolución temporal

#### Componentes Principales:

1. **Script Principal (`update_aqicn.js`)**
   - Orquesta el proceso de actualización histórica
   - Maneja estadísticas antes y después de cada actualización
   - Gestiona la limpieza inteligente de datos antiguos
   - Genera logs detallados del proceso

2. **Módulo de API (`api_aqicn.js`)**
   - Implementa detección de duplicados
   - Gestiona actualización vs inserción de datos
   - Maneja limpieza automática de datos antiguos (>30 días)
   - Proporciona estadísticas de la base de datos

3. **Base de Datos Optimizada (`db.js`)**
   - Estructura optimizada para consultas históricas
   - Índices específicos para análisis temporal
   - Constraints para evitar duplicados
   - Triggers automáticos para auditoría

### 18.2 Proceso de Actualización Histórica

El cron job ejecuta el siguiente flujo optimizado cada 6 horas:

1. **Verificación y Estadísticas Iniciales**
   - Muestra estadísticas actuales de la base de datos
   - Verifica conexión y configuración
   - Reporta total de registros, estaciones y días con datos

2. **Limpieza Inteligente**
   - Elimina únicamente datos antiguos (>30 días) para optimización
   - Mantiene todo el historial reciente para análisis
   - Reporta cantidad de registros eliminados

3. **Obtención y Procesamiento de Datos**
   - Consulta la API de AQICN para la estación 6699 (Avenida Constitución)
   - Implementa sistema de reintentos (3 intentos)
   - Procesa múltiples parámetros ambientales

4. **Almacenamiento Inteligente**
   - **Detección de duplicados**: Verifica si ya existen datos para la fecha/hora
   - **Inserción**: Nuevos datos se añaden al historial
   - **Actualización**: Datos existentes se actualizan si es necesario
   - **Transacciones**: Garantiza integridad de datos

5. **Estadísticas Finales**
   - Muestra el estado final de la base de datos
   - Confirma la actualización exitosa
   - Reporta crecimiento del historial

### 18.3 Estructura de Base de Datos Optimizada

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
    UNIQUE(estacion_id, fecha, parametro)  -- Previene duplicados
);
```

#### Índices para Consultas Históricas
```sql
-- Optimización para consultas por estación y fecha
CREATE INDEX idx_mediciones_api_estacion_fecha 
    ON mediciones_api(estacion_id, fecha DESC);

-- Optimización para consultas por parámetro y fecha
CREATE INDEX idx_mediciones_api_parametro_fecha 
    ON mediciones_api(parametro, fecha DESC);

-- Optimización para consultas temporales generales
CREATE INDEX idx_mediciones_api_fecha 
    ON mediciones_api(fecha DESC);

-- Optimización para limpieza de datos antiguos
CREATE INDEX idx_mediciones_api_created_at 
    ON mediciones_api(created_at);
```

### 18.4 Configuración Técnica

#### Variables de Entorno Requeridas
```env
DATABASE_URL=postgresql://...  # URL de PostgreSQL en Render
NODE_ENV=production
```

#### Comando de Ejecución del Cron Job
```bash
npm run update-aqicn
```

#### Frecuencia Recomendada
```cron
0 */6 * * *  # Cada 6 horas
```

### 18.5 Funcionalidades Avanzadas

#### Scripts de Gestión
- `npm run update-aqicn`: Actualización completa con historial
- `npm run stats`: Consultar estadísticas de datos históricos
- `npm run check-env`: Verificar configuración
- `npm run test-db`: Probar conexión a base de datos

#### Gestión de Datos Históricos
- **Acumulación**: Los datos se mantienen indefinidamente (hasta 30 días)
- **Optimización**: Limpieza automática de datos muy antiguos
- **Integridad**: Sistema de constraints y transacciones
- **Auditoría**: Timestamps automáticos de creación y actualización

### 18.6 Manejo de Errores y Robustez

#### Validaciones Múltiples
1. **Configuración**: Verifica DATABASE_URL antes de proceder
2. **Conexión**: Test de conectividad a PostgreSQL
3. **Datos**: Validación de respuesta de API AQICN
4. **Transacciones**: Rollback automático en caso de error

#### Sistema de Logs Detallado
```
🚀 Iniciando actualización de datos AQICN...
📊 Estadísticas actuales: X registros, Y días con datos
🧹 Limpiando datos antiguos: N registros eliminados
📥 Obteniendo datos de la API...
💾 Almacenando datos: Nuevos/Actualizados
📊 Estadísticas finales: X registros totales
✅ Actualización completada exitosamente
```

### 18.7 Ventajas del Sistema Histórico

#### Para Análisis y Predicciones
- **Tendencias**: Identificación de patrones temporales
- **Estacionalidad**: Análisis de variaciones por época del año
- **Correlaciones**: Relación entre diferentes parámetros
- **Machine Learning**: Base de datos para modelos predictivos

#### Para Rendimiento
- **Consultas Optimizadas**: Índices específicos para análisis temporal
- **Escalabilidad**: Diseño preparado para grandes volúmenes de datos
- **Mantenimiento**: Limpieza automática para optimización
- **Integridad**: Prevención de duplicados y corrupción de datos

### 18.8 Consideraciones de Seguridad y Mantenimiento

#### Seguridad
- Validación de datos de entrada de la API
- Manejo seguro de credenciales de base de datos
- Protección contra inyección SQL mediante parámetros
- Logging seguro sin exposición de datos sensibles

#### Mantenimiento
- Código modular y bien documentado
- Funciones reutilizables para diferentes operaciones
- Sistema de monitoreo mediante logs
- Fácil escalabilidad para múltiples estaciones

### 18.9 Futuras Mejoras

El sistema está preparado para:
- Incorporar múltiples estaciones de monitoreo
- Implementar alertas automáticas basadas en umbrales
- Desarrollar APIs para consultas históricas específicas
- Integrar con sistemas de machine learning para predicciones

### 18.10 Documentación Técnica Adicional

Para implementación y configuración detallada, consultar:
- `render-cron-config.md`: Guía completa de configuración en Render
- `README.md`: Documentación general del proyecto
- Código fuente comentado en el repositorio
- Logs de ejecución en el dashboard de Render

