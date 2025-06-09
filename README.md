# 🌬️ Air Gijón - Sistema de Monitoreo de Calidad del Aire

Sistema web para el monitoreo de la calidad del aire en Gijón utilizando datos de PM2.5 y predicciones con Machine Learning.

## 📁 Estructura del Proyecto

```
/
├── src/                      # 🏗️ Código fuente del backend
│   ├── server.js            # Servidor principal Express.js
│   ├── database/            # 🗄️ Módulos de base de datos
│   │   ├── db.js           # Configuración y operaciones PostgreSQL
│   │   └── *.sql           # Scripts SQL de base de datos
│   ├── services/            # 🔧 Servicios externos y APIs
│   │   ├── api_aqicn.js    # Cliente API World Air Quality Index
│   │   ├── email_service.js # Servicio de notificaciones por email
│   │   ├── api_client.js   # Cliente API genérico
│   │   └── waqiDataFetcher.js # Fetcher de datos WAQI
│   ├── auth/               # 🔐 Sistema de autenticación
│   │   └── auth.js         # JWT, bcrypt, validación usuarios
│   ├── utils/              # 🛠️ Utilidades generales
│   │   ├── utils.js        # Funciones auxiliares
│   │   └── mailer.js       # Utilidades de email
│   └── routes/             # 🛣️ Rutas API Express
│       └── users.js        # Endpoints autenticación y usuarios
├── scripts/                # 📜 Scripts de automatización
│   ├── cron/              # ⏰ Jobs programados
│   │   ├── cron_update.js
│   │   ├── cron_predictions_fixed.js
│   │   └── daily_prediction_process.js
│   ├── migration/         # 🔄 Scripts de migración BD
│   │   ├── migrate_to_new_predictions.js
│   │   └── migrate_promedios_estructura.js
│   ├── setup/             # ⚙️ Configuración inicial
│   │   ├── create_manager.js
│   │   └── create_lightgbm_model.js
│   ├── maintenance/       # 🧹 Mantenimiento y actualizaciones
│   │   ├── update_aqicn.js
│   │   ├── load_historical_data.js
│   │   ├── update_pm25_states.js
│   │   └── promedios_predicciones.js
│   └── test_*.js          # 🧪 Scripts de testing
├── frontend/              # 🎨 Aplicación React (SPA)
│   ├── src/
│   ├── public/
│   └── package.json
├── modelos_prediccion/    # 🤖 Modelos ML (Python/LightGBM)
├── config/               # ⚙️ Archivos de configuración
│   ├── .env              # Variables de entorno producción
│   ├── .env_local        # Variables de entorno desarrollo
│   └── requirements.txt  # Dependencias Python
├── docs/                 # 📚 Documentación del proyecto
└── cleaning/             # 🗂️ Archivos de desarrollo (ignorados)
```

## 🚀 Scripts NPM Disponibles

### Servidor
```bash
npm start                    # Inicia servidor en producción
npm run dev                  # Desarrollo con vite
```

### Mantenimiento
```bash
npm run update-aqicn         # Actualiza datos API AQICN
npm run cron-update          # Ejecuta job de actualización
npm run cron-predictions     # Genera predicciones diarias
npm run update-promedios     # Actualiza promedios diarios
npm run stats               # Muestra estadísticas de datos
```

### Configuración
```bash
npm run create-manager       # Crea usuario administrador
npm run migrate-predictions  # Migra estructura predicciones
```

### Datos Históricos
```bash
npm run populate-historical  # Puebla datos históricos
npm run generate-historical  # Genera datos sintéticos
```

## 🔧 Tecnologías

### Backend
- **Node.js** + **Express.js** - Servidor web
- **PostgreSQL** - Base de datos principal
- **JWT** + **bcrypt** - Autenticación segura
- **Nodemailer** - Notificaciones email
- **node-cron** - Jobs programados

### Frontend
- **React 18** - Framework UI
- **Vite** - Build tool y desarrollo
- **Lucide React** - Iconografía moderna
- **CSS3** - Estilos responsive

### Visualización de Datos
- **SVG nativo** - Gráficos vectoriales escalables
- **JavaScript ES6** - Lógica de renderizado matemático
- **CSS3 Animations** - Transiciones y efectos visuales
- **Responsive Design** - Adaptación automática a dispositivos

### Machine Learning
- **Python 3** - Procesamiento de datos
- **LightGBM** - Modelo de predicción PM2.5
- **Scikit-learn** - Preprocessing y métricas

### APIs Externas
- **World Air Quality Index API** - Datos tiempo real

## 🌍 Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@host:puerto/db
DB_USER=usuario
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=air_gijon

# APIs externas
AQICN_TOKEN=tu_token_aqicn

# Email (SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tu_email@gmail.com
MAIL_PASS=tu_app_password

# JWT
JWT_SECRET=tu_secreto_jwt_super_seguro

# URLs
BASE_URL=https://tu-backend.onrender.com
FRONTEND_URL=https://tu-frontend.onrender.com
```

## 📊 Base de Datos

### Tablas Principales
- `mediciones_api` - Datos tiempo real PM2.5
- `predicciones` - Predicciones ML generadas
- `promedios_diarios` - Agregaciones diarias
- `usuarios` - Gestión usuarios y autenticación
- `modelos_prediccion` - Metadatos modelos ML

## 🤖 Sistema de Predicciones

El sistema utiliza **LightGBM** para generar predicciones de PM2.5 con:
- Horizonte de predicción: 1-2 días
- Variables: PM2.5 histórico, tendencias, estacionalidad
- Precisión: MAE ~8.37 µg/m³
- Generación automática diaria vía cron

## 🔄 Jobs Automatizados

1. **Actualización datos AQICN** - Cada hora
2. **Generación predicciones** - Diario a las 6:00 AM
3. **Cálculo promedios** - Diario tras nuevos datos
4. **Notificaciones email** - Cuando PM2.5 > 25 µg/m³

## 📧 Sistema de Notificaciones

- **Registro usuario** - Email confirmación cuenta
- **Predicciones altas** - PM2.5 > 25 µg/m³ automático
- **Recuperación contraseña** - Token seguro temporal
- **Plantillas HTML** - Diseño profesional con logo

## 🎯 Estados Calidad del Aire

| PM2.5 (µg/m³) | Estado    | Color    | OMS     |
|---------------|-----------|----------|---------|
| 0-15          | Buena     | Verde    | AQG     |
| 16-25         | Moderada  | Amarillo | IT-4    |
| 26-50         | Regular   | Naranja  | IT-3/2  |
| 51+           | Mala      | Rojo     | IT-1    |

## 📊 Sistema de Gráficos

### Tecnologías de Visualización
Los gráficos están implementados con **SVG nativo** y **JavaScript** dentro de **React**, sin librerías externas de charting.

### Gráfico de Evolución (EvolutionCard.jsx)
```javascript
// SVG nativo con JavaScript para crear gráficos de líneas
<svg viewBox={`0 0 ${svgWidth} 220`} className="evolution-chart">
  {/* Grid lines, líneas de referencia */}
  <line x1={} y1={} x2={} y2={} stroke="..." />
  
  {/* Línea principal de datos */}
  <path d={pathData} fill="none" stroke="..." strokeWidth="3" />
  
  {/* Puntos de datos */}
  <circle cx={point.x} cy={point.y} r="5" fill="..." />
  
  {/* Etiquetas de texto */}
  <text x={} y={} fontSize={} fill="...">Valores</text>
</svg>
```

### Características Técnicas
1. **SVG Responsive**: Usa `viewBox` para escalabilidad automática
2. **Cálculos matemáticos**: JavaScript para posicionamiento de puntos
3. **CSS3**: Animaciones y transiciones suaves
4. **Diseño adaptativo**: Diferentes configuraciones para móvil/desktop

### Elementos Visuales
1. **Gráfico de líneas**: Para evolución temporal PM2.5
2. **Barras de progreso**: HTML + CSS para indicadores de calidad
3. **Iconos**: **Lucide React** (librería de iconos SVG)
4. **Indicadores de estado**: Círculos de colores y badges

### Ventajas de la Implementación
✅ **Ligero**: No dependencias pesadas  
✅ **Rápido**: Renderizado nativo del navegador  
✅ **Personalizable**: Control total sobre diseño  
✅ **Responsive**: Se adapta a cualquier pantalla  
✅ **Accesible**: Texto legible por lectores de pantalla  

---

**Air Gijón Team** - Monitoreo inteligente de calidad del aire 🌱 