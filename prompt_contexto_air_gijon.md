# Prompt de Contexto: Proyecto Air Gijón (Sesiones de Pair Programming)

## 1. Visión General del Proyecto y Stack

- **Objetivo:** Monitorizar y predecir calidad del aire (PM2.5) en Gijón, con notificaciones por correo.
- **Componentes:** Backend (Node.js/Express), Frontend (React/Vite), DB (PostgreSQL).
- **Despliegue:** Automático a Render.com desde `main` en GitHub (`https://github.com/sergioberdiales/air-gijon`).
  - URL Backend: `https://air-gijon.onrender.com` (Servicio en Render: `air-gijon`).
  - URL Frontend: `https://air-gijon-front-end.onrender.com` (Servicio en Render: `air-gijon-frontend`).
- **Entorno Local:**
  - Backend: Raíz del proyecto, `npm start`, puerto 3000.
  - Frontend: `/frontend`, `npm run dev`, puerto 5173.

## 2. Estado Actual y Enfoque Reciente

- **Arquitectura de Predicciones (Implementada):**
  - Nuevas tablas: `modelos_prediccion` (con MAE, estado activo) y `predicciones` (con `parametro`/`valor` genérico, FK a modelo).
  - `promedios_diarios` solo para datos históricos verificados (PM2.5).
  - Script de migración `migrate_to_new_predictions.js` se ejecuta automáticamente en `server.js` en producción (Render).
- **Sistema de Predicciones LightGBM (✅ COMPLETADO Y 100% FUNCIONAL EN PRODUCCIÓN):**
  - **ESTADO FINAL: SISTEMA OPERATIVO AL 100%** ✅ (8 jun 2025)
  - **Modelo entrenado**: LightGBM Modelo_1.0 con 33 variables (MAE: 8.37 µg/m³) - ACTIVO Y FUNCIONANDO
  - **Variables del modelo**: 16 lags, 13 diferencias absolutas, 2 tendencias, 2 exógenas (wd=weekday, month)
  - **Datos históricos**: 35 días cargados en producción (mayo-junio 2025) con valores realistas
  - **Predicciones reales generadas**: 
    - Hoy (8 jun): 23.28 µg/m³ (Moderada/IT-4) - horizonte_dias=0
    - Mañana (9 jun): 27.46 µg/m³ (Regular/IT-3) - horizonte_dias=1
  - **Proceso diario implementado**: Cálculo de promedios desde `mediciones_api`, interpolación de gaps, inserción en `promedios_diarios`
  - **Tabla `predicciones` actualizada**: Columnas `horizonte_dias` y `fecha_generacion` funcionando correctamente
  - **Estados OMS**: Rangos oficiales implementados (AQG ≤15, IT-4 15-25, IT-3 25-37.5, IT-2 37.5-50, IT-1 50-75, >IT-1 >75 µg/m³)
  - **Algoritmo interpolación**: Funcional para datos horarios faltantes
  - **Archivos clave**: 
    - `cron_predictions_fixed.js` - Cron job con LightGBM real funcionando
    - `modelos_prediccion/daily_predictions.py` - Script Python LightGBM operativo
    - `modelos_prediccion/lightgbm_model_v1.pkl` - Modelo serializado funcional
  - **Cron job**: `npm run cron-predictions` ejecuta `cron_predictions_fixed.js` diario a 04:30 UTC
  - **Métricas**: MAE 8.37 µg/m³ (correcto para regresión) - ROC eliminado
  - **Testing endpoints**: `/api/test/status` y `/api/test/predicciones/execute` funcionando
  - **Modelo activo**: Modelo_1.0 reemplaza completamente Modelo_0.0 dummy
  - **JSON parsing**: Problema resuelto entre Python → Node.js
  - **Base de datos**: Constraint UNIQUE funcionando con `horizonte_dias`
  - **Alertas automáticas**: Sistema funcional (enviado alerta para 27.46 > 25 µg/m³)
  - **Endpoints de migración creados**: Para cargar datos históricos y arreglar estructura en producción
  - **Verificación completa**: Datos históricos verificados contra base de datos (100% correctos)
- **Frontend – Gráfico de Evolución (`EvolutionCard.jsx`):**
  - Muestra 5 días históricos de `promedios_diarios` y 2 días de predicciones LightGBM reales desde `predicciones`.
  - **Datos mostrados verificados**: 3-7 jun (históricos) + 8-9 jun (predicciones LightGBM)
  - Completamente responsive (móvil, tablet, desktop).
  - Fechas en eje X rotadas verticalmente (‑90°) en móvil para legibilidad.
  - SVG con `viewBox` dinámico para ajustarse al contenido sin espacios vacíos.
- **Notificaciones por Correo (Implementado):**
  - Servicio de correo en `mailer.js` con Nodemailer (ENV: `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`).
  - Tabla `users` con `email_notifications_active` (BOOLEAN).
  - `cron_predictions_fixed.js` envía alertas si PM2.5 > 25 µg/m³ (funcional).
- **CSS:** `frontend/src/App.css` con CSS plano y media queries.

## 3. Base de Datos (PostgreSQL) – Tablas Relevantes

| Tabla | Columnas clave |
|-------|---------------|
| **modelos_prediccion** | `id`, `nombre_modelo`, `fecha_inicio_produccion`, `mae`, `roc_index`, `activo` (Modelo_1.0 activo) |
| **predicciones** | `id`, `fecha`, `estacion_id`, `modelo_id`, `parametro`, `valor`, `horizonte_dias`, `fecha_generacion` |
| **promedios_diarios** | `id`, `fecha`, `parametro`, `valor`, `estado`, `source` (con rangos OMS: AQG, IT-4, IT-3, IT-2, IT-1, >IT-1) |
| **mediciones_api** | `id`, `estacion_id`, `fecha`, `parametro`, `valor`, `is_validated` (datos horarios para cálculo de promedios) |
| **users** | `id`, `email`, `password_hash`, `role`, `name`, `preferences`, `email_notifications_active` |

## 4. Flujo de Trabajo y Comandos Comunes

- **Git:** `git add .`, `git commit -m "mensaje"`, `git push origin main` (CI/CD en Render).
- **Verificación Deploy:** Render Dashboard → servicio `air-gijon` → pestaña **Events**.
- **Variables Correo:** `MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`.
- **Endpoints clave:** `/api/air/constitucion/evolucion`, CRUD `/api/modelos`.
- **Cron:** `cron_predictions_fixed.js` (LightGBM real) ejecutado por `npm run cron-predictions` para predicciones y correos.

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

## 9. Sprint de entrega (⏳ 2 días finales)

### 🔥 **LUNES 9 jun (6 horas MAX) - LO MÁS CRÍTICO**

**1. Sistema de Autenticación - CRÍTICO (3-4h)**
- ❌ **Confirmar email registration** + "Olvidé contraseña" 
- ❌ **Variables EMAIL en Render** (MAIL_SERVICE, MAIL_USER, MAIL_PASS)
- **Razón:** Los usuarios NO pueden registrarse = sistema roto

**2. Limpieza de Código - ENTREGA LIMPIA (2h)**
- ❌ **Eliminar endpoints temporales** (`/api/migrate/*`, `/api/debug/*`)
- ❌ **Arreglar error CSS** "Unclosed block" línea 1089 en `App.css`
- ❌ **Eliminar código comentado** no utilizado
- **Razón:** Código sucio = mala impresión en entrega

**TOTAL LUNES: 5-6 horas** ✅

### 🟡 **MARTES 10 jun (Día completo) - FEATURES Y PULIDO**

**3. Comentarios OpenAI - FEATURE IMPORTANTE (4-5h)**
- ❌ **Implementar OpenAI** para comentarios automáticos
- ❌ **Tabla `comentarios_diarios`** en base de datos
- ❌ **Endpoint generar comentarios** basados en predicciones
- ❌ **Integrar en cron job** después de predicciones LightGBM
- ❌ **Mostrar comentarios en frontend**

**4. Documentación ESENCIAL (2-3h)**
- ❌ **README.md completo** con comandos y URLs
- ❌ **Modelo de datos** (sección 15 memoria)
- ❌ **Documentación API** actualizada

**5. UX/UI Final (2-3h)**
- ❌ **Aviso de cookies** (RGPD)
- ❌ **Revisar iconos** y formatos antiguos
- ❌ **Mejorar formato emails** de alertas

**6. Usuario gestor (si hay tiempo) (2-3h)**
- ❌ **Panel admin** básico
- ❌ **Gestión modelos** desde UI

### 🎯 **Estrategia Final:**

**LUNES (6h): Base sólida**
- Sistema de usuarios funcionando al 100%
- Código limpio y profesional para entrega

**MARTES: Features de valor añadido**
- OpenAI comentarios (diferenciador importante)
- Documentación completa y profesional
- Detalles finales de UX

**MIÉRCOLES: Margen de seguridad**
- Solo ajustes menores o imprevistos
- Entrega tranquila hasta 23:00h

### Prioridades absolutas (Si falta tiempo)

1. ✅ **LightGBM funcionando** (COMPLETADO)
2. **Sistema autenticación** (CRÍTICO lunes)
3. **Código limpio** (CRÍTICO lunes)
4. **OpenAI comentarios** (IMPORTANTE martes)
5. **Documentación** (IMPORTANTE martes)

## 10. Problemas Conocidos y Pendientes

### 10.1. CSS Frontend (`frontend/src/App.css`)

- **Error de "Unclosed block" en Vite:**
  - Vite reporta un error `[postcss] /Users/sergio/projects/air-gijon/frontend/src/App.css:1089:1: Unclosed block` relacionado con un bloque de CSS comentado (aproximadamente líneas 1075-1128).
  - El error parece estar relacionado con la forma en que Vite/PostCSS procesa los comentarios extensos o anidados.
  - **Decisión actual:** Mantener el código comentado como está, ya que la aplicación funciona correctamente en el navegador a pesar del error en la consola de Vite. Se revisará en el futuro.

- **Revisión general pendiente:**
  - El archivo `App.css` ha crecido considerablemente y podría beneficiarse de una refactorización.
  - Posibles áreas de mejora: eliminar código no utilizado, optimizar selectores, modularizar estilos (quizás con CSS Modules o Styled Components si se decide en el futuro, aunque de momento se mantiene CSS plano).

### 10.2. Sistema de Autenticación y Confirmación de Email

- **Problema con la confirmación de email:**
  - Se ha identificado que el sistema no envía correos de "Olvidé mi contraseña" a usuarios no confirmados.
  - Logs actuales muestran: `[FORGOT_PASSWORD] User found but not confirmed: sergioberdiales@gmail.com`
  - **Causa:** El sistema está diseñado para no permitir resetear contraseñas de cuentas no verificadas (medida de seguridad).
  - **Acciones pendientes:**
    1. Verificar el proceso de confirmación de email durante el registro.
    2. Asegurar que los correos de confirmación se envían correctamente.
    3. Implementar un sistema de reenvío de correos de confirmación.
    4. Considerar añadir un tiempo de expiración para los enlaces de confirmación.
  - **Estado actual:** Pendiente de revisión y corrección del flujo completo de registro y confirmación.

### 10.3. Sistema LightGBM ✅ COMPLETADO (8 jun 2025)

- **✅ LightGBM operativo al 100%** - Modelo_1.0 generando predicciones reales en producción
- **✅ 35 días de datos históricos** cargados y verificados 
- **✅ Predicciones reales**: 23.28 µg/m³ (hoy) y 27.46 µg/m³ (mañana)
- **✅ Web app funcionando** con datos LightGBM reales
- **✅ Alertas automáticas** disparándose correctamente
- **✅ Base de datos** con estructura correcta y constraints funcionando

### 10.4. Otros puntos pendientes

- **Aviso de cookies.**
- **Usuario gestor.**
- **Formato correos electrónicos.**
- **Acabar revisión de formatos antiguos (iconos, etc.).**

---

## 11. Comentarios IA con OpenAI (Planificado - No Implementado)

### 11.1. Arquitectura Propuesta

**Flujo:** `Predicciones Python → Node.js → BD (predicciones) → OpenAI API → BD (comentarios)`

### 11.2. Input para OpenAI (estructura JSON)
```json
{
  "predicciones": {
    "dia_actual": {"fecha": "2025-06-06", "valor": 39.77, "estado_oms": "IT-2"},
    "dia_siguiente": {"fecha": "2025-06-07", "valor": 37.83, "estado_oms": "IT-2"}
  },
  "historicos_recientes": [
    {"fecha": "2025-06-05", "valor": 28.7, "estado_oms": "IT-3"},
    {"fecha": "2025-06-04", "valor": 31.2, "estado_oms": "IT-3"},
    {"fecha": "2025-06-03", "valor": 27.1, "estado_oms": "IT-3"},
    {"fecha": "2025-06-02", "valor": 33.0, "estado_oms": "IT-3"},
    {"fecha": "2025-06-01", "valor": 24.0, "estado_oms": "IT-4"}
  ],
  "tendencia": "empeorando",
  "modelo_info": {"mae": 8.37, "fecha_generacion": "2025-06-06T04:30:00Z"}
}
```

### 11.3. Nueva Tabla Sugerida
```sql
CREATE TABLE comentarios_diarios (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  comentario TEXT NOT NULL,
  prediccion_dia_actual REAL,
  prediccion_dia_siguiente REAL,
  token_usage INTEGER,
  modelo_openai VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fecha)
);
```

### 11.4. Integración Recomendada
- **Ubicación:** Node.js (después de insertar predicciones)
- **Proceso asíncrono** que no bloquee predicciones
- **Variable de entorno:** `ENABLE_AI_COMMENTS=true/false`
- **Prompt Strategy Inicial:**
```
Eres un experto en calidad del aire. Analiza estos datos de PM2.5 en Gijón y genera un comentario de 2-3 frases en español:

Rangos OMS: AQG(≤15), IT-4(15-25), IT-3(25-37.5), IT-2(37.5-50), IT-1(50-75), >IT-1(>75)

[DATOS]

Responde solo el comentario, sin formato especial.
```

### 11.5. Implementación en Cron Job
```javascript
// En el script Node.js principal
async function runDailyProcess() {
  // 1. Ejecutar Python predictions
  // 2. Insertar predicciones en BD
  // 3. Si ENABLE_AI_COMMENTS: generar comentario
  // 4. Continuar con resto del proceso
}
```

**Estado:** Arquitectura planificada, pendiente de implementación después de asegurar funcionamiento de predicciones.

```
