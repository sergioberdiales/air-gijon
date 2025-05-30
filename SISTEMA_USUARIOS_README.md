# Sistema de Usuarios - Air Gijón

## 📋 Resumen

Se ha implementado un sistema completo de gestión de usuarios para la aplicación Air Gijón, permitiendo a usuarios externos registrarse, hacer login y configurar sus preferencias de notificaciones.

## 🚀 Funcionalidades Implementadas

### Frontend (React)

#### 1. **AuthContext** (`frontend/src/contexts/AuthContext.jsx`)
- Gestión global del estado de autenticación
- Funciones para login, registro, logout y actualización de preferencias
- Persistencia del token en localStorage
- Verificación automática de sesión al cargar la aplicación

#### 2. **AuthModal** (`frontend/src/components/AuthModal.jsx`)
- Modal con pestañas para Login y Registro
- Validación de formularios en tiempo real
- Mensajes de error y éxito
- Información sobre beneficios del registro

#### 3. **UserDashboard** (`frontend/src/components/UserDashboard.jsx`)
- Panel personalizado para usuarios autenticados
- Configuración de preferencias de notificaciones:
  - Alertas de calidad del aire
  - Predicciones diarias
- Información de la cuenta
- Panel especial para usuarios gestores

#### 4. **Header Mejorado** (`frontend/src/components/Header.jsx`)
- Navegación dinámica según estado de autenticación
- Menú desplegable para usuarios logueados
- Botón de login para usuarios no autenticados
- Avatar personalizado con inicial del nombre

#### 5. **App Principal** (`frontend/src/App.jsx`)
- Integración del AuthProvider
- Navegación entre vistas (Home, Perfil, Alertas)
- Renderizado condicional según vista activa

#### 6. **Estilos CSS** (`frontend/src/App.css`)
- Diseño moderno y responsive
- Animaciones suaves para modales y dropdowns
- Toggle switches para preferencias
- Paleta de colores consistente
- Adaptación móvil completa

### Backend (Ya implementado previamente)

#### 1. **Base de Datos** (`db.js`)
- Tabla `users`: Gestión de usuarios
- Tabla `prediction_metrics`: Métricas del modelo
- Tabla `notifications_sent`: Log de notificaciones

#### 2. **Autenticación** (`auth.js`)
- JWT tokens
- Encriptación bcrypt
- Middleware de autorización por roles

#### 3. **API Routes** (`routes/users.js`)
- `POST /api/users/register` - Registro
- `POST /api/users/login` - Login
- `GET /api/users/profile` - Perfil
- `PUT /api/users/preferences` - Preferencias
- `GET /api/users/dashboard` - Dashboard (gestores)

#### 4. **Sistema de Emails** (`email_service.js`)
- Plantillas HTML responsivas
- Envío de alertas y predicciones
- Configuración Gmail/SMTP

## 🎯 Tipos de Usuario

### Usuario Externo
- **Registro**: Público, solo requiere email y contraseña
- **Funcionalidades**:
  - Recibir alertas por email cuando PM2.5 > 50 μg/m³
  - Recibir predicciones diarias por email
  - Configurar preferencias de notificaciones
  - Ver dashboard personal

### Usuario Gestor (Manager)
- **Acceso**: Creado manualmente por administradores
- **Funcionalidades adicionales**:
  - Panel de gestión avanzado
  - Análisis de precisión del modelo predictivo
  - Pruebas del sistema de emails
  - Gestión de usuarios (futuro)

## 🔧 Configuración y Uso

### Desarrollo Local

1. **Backend**:
   ```bash
   node server.js
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Acceder**: http://localhost:5173

### Crear Usuario Gestor

```bash
node create_manager.js
```

### Variables de Entorno Necesarias

```env
# Base de datos
DATABASE_URL=postgresql://...

# Email (opcional)
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=tu-app-password

# JWT
JWT_SECRET=tu-secreto-jwt
```

## 🎨 Interfaz de Usuario

### Características del Diseño

- **Responsive**: Adaptado para móvil y desktop
- **Accesible**: Navegación por teclado y lectores de pantalla
- **Moderno**: Gradientes, sombras suaves, animaciones
- **Consistente**: Paleta de colores y tipografía unificada

### Navegación

- **Home**: Datos actuales y predicciones
- **Predicción**: Gráfico de evolución
- **Alertas**: Información sobre notificaciones
- **Perfil/Cuenta**: Dashboard de usuario o modal de login

### Estados de la Aplicación

1. **Usuario No Autenticado**:
   - Botón "Iniciar sesión" en header
   - Modal con pestañas Login/Registro
   - Pestaña "Cuenta" en navegación

2. **Usuario Autenticado**:
   - Avatar con inicial en header
   - Menú desplegable con opciones
   - Pestaña "Perfil" en navegación
   - Dashboard personalizado

## 📱 Responsive Design

### Móvil
- Navegación inferior fija
- Modales de pantalla completa
- Formularios optimizados para touch
- Menús desplegables adaptados

### Desktop
- Navegación superior
- Modales centrados
- Hover effects
- Dropdowns posicionados

## 🔐 Seguridad

- **Tokens JWT**: Expiración automática
- **Encriptación**: bcrypt con 12 salt rounds
- **Validación**: Frontend y backend
- **CORS**: Configurado para dominios específicos
- **Sanitización**: Inputs validados

## 🚀 Despliegue en Render

### Frontend
- Build automático con Vite
- Variables de entorno para API_BASE
- Servido como sitio estático

### Backend
- Auto-detección de puerto
- Variables de entorno configuradas
- Base de datos PostgreSQL

## 📊 Métricas y Monitoreo

- Log de registros y logins
- Tracking de preferencias de usuarios
- Métricas de emails enviados
- Análisis de precisión del modelo (gestores)

## 🔄 Flujo de Usuario Típico

1. **Nuevo Usuario**:
   - Visita la aplicación
   - Ve datos públicos de calidad del aire
   - Hace clic en "Iniciar sesión"
   - Se registra con email y contraseña
   - Configura preferencias de notificaciones
   - Recibe emails automáticos

2. **Usuario Recurrente**:
   - Inicia sesión automáticamente (token guardado)
   - Ve dashboard personalizado
   - Modifica preferencias según necesidad
   - Recibe notificaciones configuradas

## 🛠️ Mantenimiento

### Tareas Regulares
- Limpiar tokens expirados
- Monitorear logs de email
- Revisar métricas de usuarios
- Actualizar dependencias

### Troubleshooting
- Verificar conexión a base de datos
- Comprobar configuración de email
- Revisar logs del servidor
- Validar CORS en producción

## 📈 Futuras Mejoras

- [ ] Recuperación de contraseña
- [ ] Verificación de email
- [ ] Notificaciones push
- [ ] Dashboard de administración
- [ ] Métricas avanzadas de usuarios
- [ ] Integración con redes sociales
- [ ] API pública para desarrolladores

---

**Estado**: ✅ Completamente implementado y funcional
**Última actualización**: Enero 2025 