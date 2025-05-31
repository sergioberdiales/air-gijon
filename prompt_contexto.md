# Prompt de Contexto: Proyecto Air Gijón (Sesiones de Pair Programming)

## 1. Visión General del Proyecto y Stack

*   **Objetivo:** Monitorizar y predecir calidad del aire (PM2.5) en Gijón.
*   **Componentes:** Backend (Node.js/Express), Frontend (React/Vite), DB (PostgreSQL).
*   **Despliegue:** Automático a Render.com desde `main` en GitHub (`https://github.com/sergioberdiales/air-gijon`). URL: `https://air-gijon.onrender.com`.
*   **Entorno Local:**
    *   Backend: Raíz del proyecto, `npm start`, puerto 3000.
    *   Frontend: `/frontend`, `npm run dev`, puerto 5173.

## 2. Estado Actual y Enfoque Reciente

*   **Arquitectura de Predicciones (Implementada):**
    *   Nuevas tablas: `modelos_prediccion` (con ROC Index, estado activo) y `predicciones` (con `parametro`/`valor` genérico, FK a modelo).
    *   `promedios_diarios` solo para datos históricos verificados (PM2.5).
    *   Script de migración `migrate_to_new_predictions.js` se ejecuta automáticamente en `server.js` en producción (Render).
*   **Frontend - Gráfico de Evolución (`EvolutionCard.jsx`):**
    *   Muestra 5 días históricos de `promedios_diarios` y 2 días de predicciones (hoy y mañana) desde `predicciones` (usando modelo activo).
    *   Completamente responsive (móvil, tablet, desktop).
    *   Fechas en eje X rotadas verticalmente (-90°) en móvil para legibilidad.
    *   SVG con `viewBox` dinámico para ajustarse al contenido sin espacios vacíos.
    *   Sección de "cajitas" con info duplicada de predicciones ha sido eliminada.
*   **CSS:** En `frontend/src/App.css`, usando CSS plano y media queries.

## 3. Base de Datos (PostgreSQL) - Tablas Relevantes para el Contexto Actual

*   **`modelos_prediccion`**:
    *   `id` (SERIAL PK), `nombre_modelo` (VARCHAR UNIQUE), `fecha_inicio_produccion` (DATE), `roc_index` (DECIMAL), `activo` (BOOLEAN DEFAULT false).
*   **`predicciones`**:
    *   `id` (SERIAL PK), `fecha` (DATE), `estacion_id` (VARCHAR), `modelo_id` (INT FK), `parametro` (VARCHAR), `valor` (DECIMAL).
    *   Constraint UNIQUE: `(fecha, estacion_id, modelo_id, parametro)`.
*   **`promedios_diarios`**:
    *   `id` (SERIAL PK), `fecha` (DATE UNIQUE), `pm25_promedio` (REAL).
    *   (Contiene otras columnas como `pm10_promedio` pero el enfoque actual es PM2.5 para el gráfico de evolución).

## 4. Flujo de Trabajo y Comandos Comunes

*   **Git:** `git add .`, `git commit -m "mensaje"`, `git push origin main` (dispara deploy a Render).
*   **Verificación Deploy:** Dashboard de Render (`https://dashboard.render.com`) -> servicio `air-gijon` -> pestaña "Events".
*   **Backend (`server.js`):**
    *   Endpoint principal para el gráfico: `/api/air/constitucion/evolucion`.
    *   Endpoints CRUD para `/api/modelos`.
    *   Lógica de inicialización que crea tablas/índices y ejecuta migración en prod.
*   **Frontend (`EvolutionCard.jsx`):**
    *   `useEffect` para fetch de datos a `/api/air/constitucion/evolucion`.
    *   Lógica `getResponsiveConfig()` para adaptar el gráfico (espaciado, fuentes, rotación) según `window.innerWidth`.
    *   Función `formatDate()` para mostrar fechas.

## 5. Puntos Importantes para la IA

*   **Soy Sergio, el usuario.**
*   **No generar documentación redundante:** Usar este archivo y consolidar en `memoria_proyecto_air_gijon.md` o `README.md` principal. Evitar nuevos `README_nombre_funcionalidad.md`.
*   **Contexto de Render:** El deploy es automático desde GitHub. No es necesario buscar documentación sobre cómo desplegar.
*   **Base de datos `promedios_diarios`:** Recordar que ahora es solo para datos históricos, las predicciones están en `predicciones`.
*   **Objetivo de las sesiones:** Continuar desarrollando y mejorando el sistema Air Gijón.

(Este archivo se puede actualizar a medida que el proyecto evoluciona) 