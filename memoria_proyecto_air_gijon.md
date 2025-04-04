
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
- Enfoque “Mobile First”.
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
