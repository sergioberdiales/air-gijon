# Prompt de Contexto: Proyecto Air Gijón (Sesiones de Pair Programming)

## 1. Visión General del Proyecto y Stack

*   **Objetivo:** Monitorizar y predecir calidad del aire (PM2.5) en Gijón, con notificaciones por correo.
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
*   **Frontend – Gráfico de Evolución (`EvolutionCard.jsx`):**
    *   Muestra 5 días históricos de `promedios_diarios` y 2 días de predicciones (hoy y mañana) desde `predicciones` (usando modelo activo).
    *   Completamente responsive (móvil, tablet, desktop).
    *   Fechas en eje X rotadas verticalmente (-90°) en móvil para legibilidad.
    *   SVG con `viewBox` dinámico para ajustarse al contenido sin espacios vacíos.
    *   Sección de "cajitas" duplicadas eliminada.
*   **Notificaciones por Correo (Implementado):**
    *   Servicio de correo en `mailer.js` con Nodemailer (ENV: `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`).
    *   Tabla `users` con `email_notifications_active` (BOOLEAN).
    *   `cron_predictions.js` envía alertas si PM2.5 > 25 µg/m³.
*   **CSS:** `frontend/src/App.css` con CSS plano y media queries.

## 3. Base de Datos (PostgreSQL) – Tablas Relevantes

| Tabla                 | Columnas clave                                                        |
| :-------------------- | :-------------------------------------------------------------------- |
| `modelos_prediccion`  | `id`, `nombre_modelo`, `fecha_inicio_produccion`, `roc_index`, `activo` |
| `predicciones`        | `id`, `fecha`, `estacion_id`, `modelo_id`, `parametro`, `valor`         |
| `promedios_diarios`   | `id`, `fecha`, `pm25_promedio`                                        |
| `users`               | `id`, `email`, `password_hash`, `role`, `name`, `preferences`, `email_notifications_active` |

## 4. Flujo de Trabajo y Comandos Comunes

*   **Git:** `git add .`, `git commit -m "mensaje"`, `git push origin main` (CI/CD en Render).
*   **Verificación Deploy:** Render Dashboard → servicio `air-gijon` → pestaña Events.
*   **Variables Correo:** `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`.
*   **Endpoints clave:** `/api/air/constitucion/evolucion`, CRUD `/api/modelos`.
*   **Cron:** `cron_predictions.js` para predicciones y correos.

## 5. Puntos Importantes para la IA

*   Soy Sergio, el usuario.
*   No generes documentación redundante; usa este archivo y un `README.md` principal.
*   Render gestiona el deploy; no escribir pasos de despliegue.
*   Históricos en `promedios_diarios`, predicciones en `predicciones`.
*   Notificaciones solo si `email_notifications_active = true`.

## 6. Buenas Prácticas de Programación y Estilo

*   Comentarios y docs en español (JSDoc incluido).
*   Nomenclatura en inglés (camelCase para código, snake_case en BD, CONSTANTES en MAYÚSCULAS).
*   Carpetas por feature; un único README por raíz/sub-app.
*   Estilo de código: Prettier + ESLint (Airbnb). Verifica `.eslintrc`, `.prettierrc`; propone configuración mínima si falta.
*   Commits: Conventional Commits; ramas `feature/hotfix` con PR.
*   `.env` para credenciales, cargado con `dotenv`.
*   Errores/logs: handler central; `winston` en prod.
*   Seguridad: `express-validator`, `helmet`, `bcrypt`, JWT 24h.
*   Pruebas: Jest + Supertest / React Testing Library; mínimo tests críticos.
*   Accesibilidad: WCAG 2.1 AA, mobile-first.
*   I18n: textos en `/locales/es.json`.
*   Sin mensajes personales en código.
*   Dependencias: `npm prune` periódico.
*   Cron documentado.
*   Revisiones: revisa sugerencias IA antes de merge.

## 7. Comportamiento esperado de la IA

*   Sé crítico; no elogios automáticos.
*   Prioriza rigor técnico.
*   Argumenta con pros/contras y referencias.
*   Sé breve y directo.

## 8. Directrices de Diseño Front-End (UI/UX)

*   Mobile-First; escalar con `min-width`.
*   Paleta sobria: máx. 3-4 colores.
*   Tipografía: sans-serif (Inter/Roboto), `rem`/`em`.
*   Espaciado 4px scale.
*   Design System mínimo en `/components/ui`.
*   Botones sin lógica: desactivar o eliminar.
*   Navegación clara: bottom nav + hamburger.
*   Accesibilidad: contraste AA ≥ 4.5 : 1, focus visible.
*   Animaciones: 150-250ms, discretas.
*   Rendimiento: imágenes óptimas, SVG inline, `loading="lazy"`.

## 9. Sprint de entrega (⏳ 7 días)

*   **Prioridades absolutas:**
    *   Datos históricos correctos.
    *   Predicción 1 día.
    *   Emails de alerta.
    *   UI coherente (sin botones huérfanos).
*   **Puede esperar:**
    *   Cobertura alta de tests (mantén críticos).
    *   Design System completo.
    *   CI complejo.
    *   Refactors grandes.
*   **Tips exprés:**
    *   Reutiliza hooks existentes.
    *   Usa librerías maduras (Chart.js, shadcn/ui).
    *   Desactiva ESLint no crucial puntualmente.
    *   Documenta comandos y URL demo en `README.md`.
    *   Commits diarios estables.

(Actualiza este archivo si el proyecto evoluciona)

