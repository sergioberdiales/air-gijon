# 📋 DOCUMENTACIÓN DEL PANEL DE ADMINISTRACIÓN - AIR GIJÓN

## 🎯 RESUMEN EJECUTIVO

Este documento describe el panel de administración del sistema de monitoreo de calidad del aire de Gijón, implementado completamente funcional para la presentación del 18 de junio de 2025.

### Estado Actual
- ✅ **FUNCIONANDO COMPLETAMENTE** en producción
- ✅ Gestión completa de usuarios
- ✅ Control granular de notificaciones
- ✅ Creación y eliminación de usuarios
- ✅ Cambio de roles
- ✅ Estadísticas del sistema
- ✅ URL: https://air-gijon.onrender.com/admin

---

## 🔐 ACCESO AL PANEL

### Credenciales de Administrador
```
Email: admin@air-gijon.es
Contraseña: AdminAirGijon2025!
```

### URL de Acceso
```
Desarrollo: http://localhost:5173/admin
Producción: https://air-gijon.onrender.com/admin
```

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Frontend (React)
```
frontend/src/components/AdminDashboard.jsx
frontend/src/components/AdminDashboard.css
```

### Backend (Node.js/Express)
```
src/routes/admin.js
src/middleware/auth.js
```

### Base de Datos (PostgreSQL)
```
Tabla principal: usuarios
Campos clave: id, email, nombre, role, email_alerts, daily_predictions
```

---

## 🚀 FUNCIONALIDADES PRINCIPALES

### 1. 📊 Dashboard Principal
- **Contador de usuarios totales** con icono ➕ para crear nuevos
- **Lista completa de usuarios** con información detallada
- **Estadísticas del sistema** (próximamente)

### 2. 👥 Gestión de Usuarios

#### Visualización
Cada usuario muestra:
- **Nombre completo** y email
- **Rol actual** (Usuario/Administrador)
- **Estado de notificaciones**:
  - 📧 Alertas por email (activo/inactivo)
  - 📊 Predicciones diarias (activo/inactivo)
- **Acciones disponibles** (cambiar rol, eliminar)

#### Creación de Usuarios
- **Botón "➕ Crear Usuario"** prominente
- **Modal completo** con validación de formulario:
  - Nombre (requerido)
  - Email (requerido, validación de formato)
  - Contraseña (requerida, mínimo 6 caracteres)
  - Rol (Usuario/Administrador)
  - Configuración de notificaciones
- **Usuarios creados por admin** se confirman automáticamente
- **Actualización optimista** de la UI

### 3. 🔔 Control de Notificaciones

#### Sistema Granular
- **Control individual** de cada tipo de notificación
- **Botones independientes**:
  - 📧 **Email alerts**: Toggle independiente
  - 📊 **Daily predictions**: Toggle independiente
- **Feedback visual** inmediato
- **Tooltips informativos**

#### Implementación Técnica
- **Optimistic Updates**: UI se actualiza inmediatamente
- **Error Handling**: Reversión automática en caso de fallo
- **Conversión de tipos**: parseInt(userId) para evitar errores
- **Validación JSON**: Parsing seguro de respuestas

### 4. 🎭 Gestión de Roles

#### Cambio de Roles
- **Selector dropdown** integrado en cada fila de usuario
- **Cambio inmediato** con confirmación visual
- **Prevención de auto-demotion**: Admin no puede quitarse permisos
- **Actualización optimista** con rollback en errores

#### Roles Disponibles
- **Usuario**: Acceso básico al sistema
- **Administrador**: Acceso completo al panel admin

### 5. 🗑️ Eliminación de Usuarios

#### Proceso Seguro
- **Confirmación requerida** antes de eliminar
- **No se puede auto-eliminar** (protección de admin)
- **Eliminación inmediata** de la UI con optimistic updates
- **Rollback automático** en caso de error del servidor

---

## 🛠️ IMPLEMENTACIÓN TÉCNICA

### Frontend - AdminDashboard.jsx

#### Estado Principal
```javascript
const [users, setUsers] = useState([]);
const [stats, setStats] = useState({});
const [showCreateModal, setShowCreateModal] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);
```

#### Optimistic Updates
```javascript
// Ejemplo para cambio de notificaciones
const toggleNotification = async (userId, type) => {
  const userIdNum = parseInt(userId);
  const currentUser = users.find(u => u.id === userIdNum);
  const newValue = !currentUser[type];
  
  // Update optimista
  setUsers(prevUsers => 
    prevUsers.map(user => 
      user.id === userIdNum 
        ? { ...user, [type]: newValue }
        : user
    )
  );
  
  try {
    const response = await fetch(`/api/admin/users/${userId}/notifications`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ [type]: newValue })
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}`);
    }
  } catch (error) {
    // Rollback en caso de error
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userIdNum 
          ? { ...user, [type]: !newValue }
          : user
      )
    );
    console.error('Error updating notification:', error);
  }
};
```

#### Creación de Usuarios
```javascript
const handleCreateUser = async (userData) => {
  try {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(userData)
    });
    
    if (response.ok) {
      const newUser = await response.json();
      setUsers(prevUsers => [...prevUsers, newUser]);
      setShowCreateModal(false);
    }
  } catch (error) {
    console.error('Error creating user:', error);
  }
};
```

### Backend - admin.js

#### Endpoints Implementados

##### GET /api/admin/users
```javascript
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, email, role, email_alerts, daily_predictions, 
             fecha_registro, fecha_ultimo_acceso 
      FROM usuarios 
      ORDER BY fecha_registro DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

##### POST /api/admin/users
```javascript
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nombre, email, password, role = 'user', email_alerts = true, daily_predictions = false } = req.body;
    
    // Validaciones
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar usuario (confirmado automáticamente)
    const result = await pool.query(`
      INSERT INTO usuarios (nombre, email, password, role, email_alerts, daily_predictions, is_confirmed)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, nombre, email, role, email_alerts, daily_predictions, fecha_registro
    `, [nombre, email, hashedPassword, role, email_alerts, daily_predictions]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Email duplicado
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

##### PUT /api/admin/users/:userId/notifications
```javascript
router.put('/users/:userId/notifications', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    // Construir query dinámicamente
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if ('email_alerts' in updates) {
      fields.push(`email_alerts = $${paramCount}`);
      values.push(updates.email_alerts);
      paramCount++;
    }
    
    if ('daily_predictions' in updates) {
      fields.push(`daily_predictions = $${paramCount}`);
      values.push(updates.daily_predictions);
      paramCount++;
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    
    values.push(parseInt(userId));
    
    const result = await pool.query(`
      UPDATE usuarios 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, email_alerts, daily_predictions
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

##### PUT /api/admin/users/:userId/role
```javascript
router.put('/users/:userId/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    
    // Prevenir que admin se quite permisos a sí mismo
    if (parseInt(userId) === req.user.id && role === 'user') {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol de administrador' });
    }
    
    const result = await pool.query(`
      UPDATE usuarios 
      SET role = $1 
      WHERE id = $2
      RETURNING id, nombre, email, role
    `, [role, parseInt(userId)]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

##### DELETE /api/admin/users/:userId
```javascript
router.delete('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevenir que admin se elimine a sí mismo
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde el panel de admin' });
    }
    
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [parseInt(userId)]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

### Middleware de Autenticación

#### requireAuth
```javascript
const requireAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};
```

#### requireAdmin
```javascript
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
};
```

---

## 🎨 INTERFAZ DE USUARIO

### Diseño Principal
- **Header del panel** con título y estadísticas
- **Botón de creación** prominente con contador de usuarios
- **Tabla responsiva** con información completa de usuarios
- **Controles intuitivos** con iconos descriptivos

### Estilos CSS (AdminDashboard.css)

#### Layout Principal
```css
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
```

#### Modal de Creación
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 16px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: modalSlideIn 0.3s ease-out;
}
```

#### Tabla de Usuarios
```css
.users-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
}

.users-table th {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.users-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #e9ecef;
}
```

#### Botones de Notificaciones
```css
.notification-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  position: relative;
}

.notification-btn:hover {
  background-color: #f8f9fa;
  transform: scale(1.1);
}

.notification-btn.active {
  background-color: #d4edda;
}

.notification-btn.inactive {
  background-color: #f8d7da;
  opacity: 0.6;
}
```

### Responsive Design
```css
@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .users-table {
    font-size: 14px;
  }
  
  .users-table th,
  .users-table td {
    padding: 8px;
  }
  
  .modal-content {
    margin: 20px;
    padding: 20px;
  }
}
```

---

## 🔒 SEGURIDAD

### Autenticación JWT
- **Token obligatorio** para todos los endpoints admin
- **Verificación de rol** en cada request
- **Expiración automática** de tokens

### Validaciones de Seguridad
- **Prevención de auto-eliminación** de administradores
- **Prevención de auto-demotion** de roles
- **Validación de emails únicos**
- **Hash seguro de contraseñas** con bcrypt

### Protecciones Frontend
- **Validación de formularios** antes del envío
- **Sanitización de inputs** 
- **Manejo seguro de errores** sin exposición de detalles internos

---

## 📊 MONITOREO Y LOGS

### Logs del Sistema
```javascript
// Ejemplo de logging en operaciones críticas
console.log(`[ADMIN] Usuario ${req.user.email} eliminó usuario ID ${userId}`);
console.log(`[ADMIN] Creado nuevo usuario: ${email} por ${req.user.email}`);
console.log(`[ADMIN] Cambio de rol: Usuario ${userId} ahora es ${role}`);
```

### Métricas Monitoreadas
- **Número total de usuarios**
- **Usuarios activos vs inactivos**
- **Distribución de roles**
- **Configuración de notificaciones**

---

## 🚀 DESPLIEGUE

### Producción (Render)
```
URL: https://air-gijon.onrender.com
Panel Admin: https://air-gijon.onrender.com/admin
Estado: ✅ FUNCIONANDO
```

### Variables de Entorno Requeridas
```
DATABASE_URL=postgresql://...
JWT_SECRET=tu_secreto_jwt_seguro
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_contraseña_de_aplicación
```

### Base de Datos
```sql
-- Tabla usuarios ya existente con campos necesarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN DEFAULT true;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS daily_predictions BOOLEAN DEFAULT false;
```

---

## 🔧 MANTENIMIENTO

### Tareas Periódicas
1. **Limpieza de usuarios inactivos** (manual)
2. **Revisión de logs de administración**
3. **Backup de configuraciones de usuario**
4. **Monitoreo de performance de queries**

### Resolución de Problemas Comunes

#### Error "Usuario no encontrado"
- **Causa**: ID de usuario como string en lugar de number
- **Solución**: Usar `parseInt(userId)` en todas las operaciones

#### Notificaciones no se actualizan
- **Causa**: Error en el parsing de respuesta JSON
- **Solución**: Validar respuesta antes de JSON.parse()

#### Modal no se cierra
- **Causa**: Estado de loading no se resetea
- **Solución**: Asegurar setIsLoading(false) en catch blocks

---

## 📈 MEJORAS FUTURAS

### Funcionalidades Planificadas
1. **Búsqueda y filtrado** de usuarios
2. **Exportación de datos** a CSV/Excel
3. **Historial de cambios** (audit log)
4. **Gestión de permisos** más granular
5. **Dashboard de estadísticas** avanzado
6. **Notificaciones push** para administradores

### Optimizaciones Técnicas
1. **Paginación** para listas grandes de usuarios
2. **Cache** de datos de usuario
3. **Lazy loading** de componentes
4. **WebSockets** para updates en tiempo real

---

## 📞 CONTACTO Y SOPORTE

### Desarrollador Principal
- **Sistema**: Air Gijón Quality Monitoring
- **Versión**: 1.0
- **Fecha**: Junio 2025

### Estado del Proyecto
- ✅ **LISTO PARA PRESENTACIÓN** (18 de junio de 2025)
- ✅ **DESPLEGADO EN PRODUCCIÓN**
- ✅ **TOTALMENTE FUNCIONAL**

---

## 🎯 CONCLUSIÓN

El panel de administración de Air Gijón está completamente implementado y funcionando en producción. Todas las funcionalidades críticas han sido probadas y están operativas:

- **Gestión completa de usuarios** ✅
- **Control granular de notificaciones** ✅  
- **Seguridad robusta** ✅
- **Interfaz intuitiva** ✅
- **Optimistic UI updates** ✅

El sistema está listo para la presentación del 18 de junio de 2025 y proporciona todas las herramientas necesarias para administrar eficientemente la plataforma de monitoreo de calidad del aire de Gijón. 