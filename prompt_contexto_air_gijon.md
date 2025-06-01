# Prompt de Contexto: Proyecto Air Gijón (Sesiones de Pair Programming)

## 1. Visión General del Proyecto y Stack

- **Objetivo:** Monitorizar y predecir calidad del aire (PM2.5) en Gijón, con notificaciones por correo.
- **Componentes:** Backend (Node.js/Express), Frontend (React/Vite), DB (PostgreSQL).
- **Despliegue:** Automático a Render.com desde `main` en GitHub (`https://github.com/sergioberdiales/air-gijon`). URL: `https://air-gijon.onrender.com`.
- **Entorno Local:**
  - Backend: Raíz del proyecto, `npm start`, puerto 3000.
  - Frontend: `/frontend`, `npm run dev`, puerto 5173.

## 2. Estado Actual y Enfoque Reciente

- **Arquitectura de Predicciones (Implementada):**
  - Nuevas tablas: `modelos_prediccion` (con ROC Index, estado activo) y `predicciones` (con `parametro`/`valor` genérico, FK a modelo).
  - `promedios_diarios` solo para datos históricos verificados (PM2.5).
  - Script de migración `migrate_to_new_predictions.js` se ejecuta automáticamente en `server.js` en producción (Render).
- **Frontend – Gráfico de Evolución (`EvolutionCard.jsx`):**
  - Muestra 5 días históricos de `promedios_diarios` y 2 días de predicciones (hoy y mañana) desde `predicciones` (usando modelo activo).
  - Completamente responsive (móvil, tablet, desktop).
  - Fechas en eje X rotadas verticalmente (‑90°) en móvil para legibilidad.
  - SVG con `viewBox` dinámico para ajustarse al contenido sin espacios vacíos.
  - Sección de "cajitas" duplicadas eliminada.
- **Notificaciones por Correo (Implementado):**
  - Servicio de correo en `mailer.js` con Nodemailer (ENV: `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`).
  - Tabla `users` con `email_notifications_active` (BOOLEAN).
  - `cron_predictions.js` envía alertas si PM2.5 > 25 µg/m³.
- **CSS:** `frontend/src/App.css` con CSS plano y media queries.

## 3. Base de Datos (PostgreSQL) – Tablas Relevantes

| Tabla | Columnas clave |
|-------|---------------|
| **modelos_prediccion** | `id`, `nombre_modelo`, `fecha_inicio_produccion`, `roc_index`, `activo` |
| **predicciones** | `id`, `fecha`, `estacion_id`, `modelo_id`, `parametro`, `valor` |
| **promedios_diarios** | `id`, `fecha`, `pm25_promedio` |
| **users** | `id`, `email`, `password_hash`, `role`, `name`, `preferences`, `email_notifications_active` |

## 4. Flujo de Trabajo y Comandos Comunes

- **Git:** `git add .`, `git commit -m "mensaje"`, `git push origin main` (CI/CD en Render).
- **Verificación Deploy:** Render Dashboard → servicio `air-gijon` → pestaña **Events**.
- **Variables Correo:** `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`.
- **Endpoints clave:** `/api/air/constitucion/evolucion`, CRUD `/api/modelos`.
- **Cron:** `cron_predictions.js` para predicciones y correos.

## 5. Puntos Importantes para la IA

- **Soy Sergio, el usuario.**
- No generes documentación redundante; usa este archivo y un `README.md` principal.
- Render gestiona el deploy; no escribir pasos de despliegue.
- Históricos en `promedios_diarios`, predicciones en `predicciones`.
- Notificaciones solo si `email_notifications_active = true`.

---

## 6. Buenas Prácticas de Programación y Estilo

1. **Comentarios y docs en español** (JSDoc incluido).
2. **Nomenclatura en inglés** (`camelCase` para código, `snake_case` en BD, CONSTANTES en MAYÚSCULAS).
3. **Carpetas por feature**; un único `README` por raíz/sub‑app.
4. **Estilo de código**: Prettier + ESLint (Airbnb). Verifica `.eslintrc`, `.prettierrc`; propone configuración mínima si falta.
5. **Commits**: Conventional Commits; ramas feature/hotfix con PR.
6. **.env** para credenciales, cargado con `dotenv`.
7. **Errores/logs**: handler central; `winston` en prod.
8. **Seguridad**: `express-validator`, `helmet`, bcrypt, JWT 24 h.
9. **Pruebas**: Jest + Supertest / React Testing Library; mínimo tests críticos.
10. **Accesibilidad**: WCAG 2.1 AA, mobile‑first.
11. **I18n**: textos en `/locales/es.json`.
12. **Sin mensajes personales** en código.
13. **Dependencias**: `npm prune` periódico.
14. **Cron** documentado.
15. **Revisiones**: revisa sugerencias IA antes de merge.

## 7. Comportamiento esperado de la IA

- Sé crítico; no elogios automáticos.
- Prioriza rigor técnico.
- Argumenta con pros/contras y referencias.
- Sé breve y directo.

## 8. Directrices de Diseño Front‑End (UI/UX)

- **Mobile‑First**: el layout se diseña primero para ≤ 375 px y se escala con media‑queries `min-width`.
- **Paleta sobria**: máximo 3‑4 colores; **usa los tokens definidos en `globals.css` y en `tailwind.config.js` (colores y opacidades HSL)** en lugar de valores hard‑codeados.
- **Tipografía**: sans‑serif (`Inter`, `Roboto`); tamaños relativos (`rem`, `em`).
- **Espaciado**: sistema de 4 px (4‑8‑16‑24…).
- **Iconografía**: emplea **lucide‑react** (`strokeWidth={2}`) —instalado en el proyecto— y mantén trazos consistentes.
- **Design System mínimo**: componentes reutilizables (`Button`, `Card`, `Badge`, etc.) en `/components/ui`.
- **Botones sin lógica**: desactívalos (`disabled`) o elimínalos hasta conectar backend.
- **Navegación clara**: bottom‑nav fija en móvil y menú hamburguesa para secciones secundarias.
- **Accesibilidad**: contraste AA ≥ 4.5 : 1; foco visible; roles/`aria-label` correctos.
- **Animaciones**: transiciones de 150‑250 ms en color/transform; evita animaciones bloqueantes.
- **Rendimiento**: imágenes `webp/avif`, SVG inline, `loading="lazy"` y `prefers-reduced-motion`.

### Animaciones y micro‑interacciones

- Usa las **keyframes extendidas** del `tailwind.config.js` (`fade-in`, `slide-up`, `scale-in`, etc.) para coherencia.

## 9. Sprint de entrega (⏳ 7 días)

### Prioridades absolutas

1. Datos históricos correctos.
2. Predicción 1 día.
3. Emails de alerta.
4. UI coherente (sin botones huérfanos).

### Puede esperar

- Cobertura alta de tests (mantén críticos).
- Design System completo.
- CI complejo.
- Refactors grandes.

### Tips exprés

- Reutiliza hooks existentes.
- Usa librerías maduras (Chart.js, shadcn/ui).
- Desactiva ESLint no crucial puntualmente.
- Documenta comandos y URL demo en `README.md`.
- Commits diarios estables.

---

*(Actualiza este archivo si el proyecto evoluciona)*

---

## 10. Problemas Conocidos y Pendientes

### 10.1. CSS Frontend (`frontend/src/App.css`)

- **Error de "Unclosed block" en Vite:**
  - Vite reporta un error `[postcss] /Users/sergio/projects/air-gijon/frontend/src/App.css:1089:1: Unclosed block` relacionado con un bloque de CSS comentado (aproximadamente líneas 1075-1128).
  - El error parece estar relacionado con la forma en que Vite/PostCSS procesa los comentarios extensos o anidados.
  - **Decisión actual:** Mantener el código comentado como está, ya que la aplicación funciona correctamente en el navegador a pesar del error en la consola de Vite. Se revisará en el futuro.
- **Revisión general pendiente:**
  - El archivo `App.css` ha crecido considerablemente y podría beneficiarse de una refactorización.
  - Posibles áreas de mejora: eliminar código no utilizado, optimizar selectores, modularizar estilos (quizás con CSS Modules o Styled Components si se decide en el futuro, aunque de momento se mantiene CSS plano).
```
