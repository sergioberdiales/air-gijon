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

## 18. Automatización de la actualización de datos (Cron Job)

Para garantizar que la base de datos de la aplicación se mantenga actualizada con los datos más recientes de calidad del aire, se ha implementado un cron job en Render llamado `update-aqicn`. Este sistema automatizado es crucial para mantener la información actualizada y precisa para los usuarios.

### 18.1 Arquitectura del Sistema

El sistema de actualización automática está compuesto por dos componentes principales:

1. **Script Principal (`update_aqicn.js`)**
   - Orquesta el proceso de actualización
   - Maneja la conexión a la base de datos
   - Gestiona errores y reintentos
   - Genera logs detallados

2. **Módulo de API (`api_aqicn.js`)**
   - Contiene las funciones de obtención y almacenamiento de datos
   - Implementa la lógica de comunicación con AQICN
   - Maneja el procesamiento de datos
   - Gestiona transacciones en la base de datos

### 18.2 Proceso de Actualización

El cron job ejecuta el siguiente flujo cada hora:

1. **Limpieza de Datos**
   - Limpia la tabla `mediciones_api` para evitar duplicados
   - Utiliza transacciones para garantizar la integridad

2. **Obtención de Datos**
   - Consulta la API de AQICN para la estación 6699
   - Implementa sistema de reintentos (3 intentos)
   - Maneja errores de red y API

3. **Almacenamiento**
   - Guarda múltiples parámetros:
     - PM10 y PM2.5
     - NO2 y SO2
     - O3
     - Variables meteorológicas

### 18.3 Configuración Técnica

#### Variables de Entorno
```env
DATABASE_URL=postgresql://...  # Internal Database URL de Render
NODE_ENV=production
AQICN_TOKEN=tu_token_de_aqicn
```

#### Comando de Ejecución
```bash
cd /opt/render/project/src && npm run update-aqicn
```

### 18.4 Manejo de Errores y Robustez

El sistema implementa varias capas de seguridad:

1. **Validación de Configuración**
   - Verifica variables de entorno
   - Comprueba conexión a base de datos
   - Valida token de API

2. **Reintentos Automáticos**
   - 3 intentos en caso de fallo
   - Delay exponencial entre intentos
   - Logging detallado de errores

3. **Transacciones en Base de Datos**
   - Rollback automático en caso de error
   - Liberación de conexiones
   - Manejo de timeouts

### 18.5 Monitoreo y Logs

El sistema genera logs detallados en cada paso:
- 🗑️ Limpieza de tabla
- 📥 Obtención de datos
- 📊 Visualización de datos
- 💾 Almacenamiento
- ✅ Confirmación de éxito

### 18.6 Mantenimiento y Actualizaciones

El sistema está diseñado para ser:
- Fácil de mantener
- Escalable
- Robusto ante fallos
- Fácil de depurar

### 18.7 Consideraciones de Seguridad

- Validación de datos de entrada
- Manejo seguro de credenciales
- Protección contra inyección SQL
- Logging seguro de errores

### 18.8 Documentación Adicional

Para más detalles técnicos sobre la implementación, consultar:
- Código fuente en el repositorio
- Documentación en README.md
- Logs de ejecución en Render

