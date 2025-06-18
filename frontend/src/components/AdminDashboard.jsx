import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role_id: 1,
    email_alerts: false,
    daily_predictions: false
  });

  // Función para obtener lista de usuarios
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.API_BASE}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setError('Error cargando usuarios');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Función para crear nuevo usuario
  const createUser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Usuario creado exitosamente:', data);
        
        // Actualizar la lista de usuarios sin recargar
        setUsers(prevUsers => [...prevUsers, data.user]);
        
        // Limpiar formulario y cerrar modal
        setNewUser({
          email: '',
          password: '',
          name: '',
          role_id: 1,
          email_alerts: false,
          daily_predictions: false
        });
        setShowCreateModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error creando usuario');
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Función para cambiar rol de usuario
  const changeUserRole = async (userId, newRoleId) => {
    console.log('🔄 Cambiando rol:', { userId, newRoleId });
    
    // Actualización optimista
    setUsers(prevUsers => 
      prevUsers.map(u => 
        u.id === userId 
          ? { ...u, role_id: newRoleId, role_name: newRoleId === 2 ? 'admin' : 'user' }
          : u
      )
    );
    
    try {
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role_id: newRoleId })
      });

      console.log('📊 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Rol cambiado exitosamente:', data);
        
        // Actualizar con datos reales del servidor
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === userId ? { ...u, ...data.user } : u
          )
        );
      } else {
        const errorText = await response.text();
        console.error('❌ Error cambiando rol:', errorText);
        setError('Error cambiando rol de usuario');
        
        // Revertir cambio optimista
        fetchUsers();
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión');
      
      // Revertir cambio optimista
      fetchUsers();
    }
  };

  // Función para eliminar usuario (corregida)
  const deleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }
    
    console.log('🗑️ Eliminando usuario:', userId);
    
    // Actualización optimista - remover de la lista
    const originalUsers = [...users];
    setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
    
    try {
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Delete response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Usuario eliminado exitosamente:', data);
        // El usuario ya fue eliminado optimísticamente
        setError(null); // Limpiar cualquier error previo
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('❌ Error eliminando usuario:', errorData);
        setError(errorData.error || 'Error eliminando usuario');
        
        // Revertir eliminación optimista
        setUsers(originalUsers);
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión al eliminar usuario');
      
      // Revertir eliminación optimista
      setUsers(originalUsers);
    }
  };

  // Función para gestionar notificaciones individuales
  const toggleEmailAlerts = async (userId, currentValue) => {
    const newValue = !currentValue;
    
    console.log('📧 Cambiando alertas de email:', { userId, newValue });
    
    // Actualización optimista
    const originalUsers = [...users];
    setUsers(prevUsers => 
      prevUsers.map(u => 
        u.id === userId 
          ? { ...u, email_alerts: newValue }
          : u
      )
    );
    
    try {
      const user = users.find(u => u.id === userId);
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email_alerts: newValue,
          daily_predictions: user.daily_predictions // Mantener el valor actual
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Alertas de email actualizadas:', data);
        setError(null); // Limpiar cualquier error previo
        
        // Actualizar con datos reales del servidor
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === userId ? { ...u, ...data.user } : u
          )
        );
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('❌ Error actualizando alertas:', errorData);
        setError(errorData.error || 'Error actualizando alertas de email');
        
        // Revertir cambio optimista
        setUsers(originalUsers);
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión al actualizar alertas');
      
      // Revertir cambio optimista
      setUsers(originalUsers);
    }
  };

  const toggleDailyPredictions = async (userId, currentValue) => {
    const newValue = !currentValue;
    
    console.log('📊 Cambiando predicciones diarias:', { userId, newValue });
    
    // Actualización optimista
    const originalUsers = [...users];
    setUsers(prevUsers => 
      prevUsers.map(u => 
        u.id === userId 
          ? { ...u, daily_predictions: newValue }
          : u
      )
    );
    
    try {
      const user = users.find(u => u.id === userId);
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email_alerts: user.email_alerts, // Mantener el valor actual
          daily_predictions: newValue
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Predicciones diarias actualizadas:', data);
        setError(null); // Limpiar cualquier error previo
        
        // Actualizar con datos reales del servidor
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === userId ? { ...u, ...data.user } : u
          )
        );
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        console.error('❌ Error actualizando predicciones:', errorData);
        setError(errorData.error || 'Error actualizando predicciones diarias');
        
        // Revertir cambio optimista
        setUsers(originalUsers);
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión al actualizar predicciones');
      
      // Revertir cambio optimista
      setUsers(originalUsers);
    }
  };

  // Cargar usuarios al montar el componente
  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  // Verificar si es admin
  if (!user || user.role_name !== 'admin') {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <strong>Acceso denegado:</strong> Solo los administradores pueden acceder a esta página.
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Panel de Administración</h1>
        <p>Gestión de usuarios del sistema Air Gijón</p>
      </div>

      <div className="admin-content">
        {loading && (
          <div className="loading-message">
            <div className="spinner"></div>
            Cargando usuarios...
          </div>
        )}
        
        {error && (
          <div className="error-message">
            ❌ {error}
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        )}

        <div className="users-section">
          <div className="users-header">
            <h2>Usuarios Registrados ({users.length})</h2>
            <div className="header-buttons">
              <button 
                className="create-user-button"
                onClick={() => setShowCreateModal(true)}
                disabled={loading}
              >
                ➕ Crear Usuario
              </button>
              <button 
                className="refresh-button"
                onClick={fetchUsers}
                disabled={loading}
              >
                🔄 Actualizar
              </button>
            </div>
          </div>

          {users.length > 0 ? (
            <div className="table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Notificaciones</th>
                    <th>Registro</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td>{userItem.id}</td>
                      <td>{userItem.name || 'Sin nombre'}</td>
                      <td>{userItem.email}</td>
                      <td>
                        <span className={`role-badge ${userItem.role_id === 2 ? 'admin' : 'user'}`}>
                          {userItem.role_id === 2 ? '👑 Admin' : '👤 Usuario'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${userItem.is_confirmed ? 'confirmed' : 'pending'}`}>
                          {userItem.is_confirmed ? '✅ Confirmado' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td>
                        <div className="notifications-cell">
                          <button 
                            className={`notification-button ${userItem.email_alerts ? 'enabled' : 'disabled'}`}
                            onClick={() => toggleEmailAlerts(userItem.id, userItem.email_alerts)}
                            disabled={loading}
                            title={`${userItem.email_alerts ? 'Desactivar' : 'Activar'} alertas por email`}
                          >
                            📧 {userItem.email_alerts ? 'Sí' : 'No'}
                          </button>
                          <button 
                            className={`notification-button ${userItem.daily_predictions ? 'enabled' : 'disabled'}`}
                            onClick={() => toggleDailyPredictions(userItem.id, userItem.daily_predictions)}
                            disabled={loading}
                            title={`${userItem.daily_predictions ? 'Desactivar' : 'Activar'} predicciones diarias`}
                          >
                            📊 {userItem.daily_predictions ? 'Sí' : 'No'}
                          </button>
                        </div>
                      </td>
                      <td>{new Date(userItem.created_at).toLocaleDateString('es-ES')}</td>
                      <td>
                        <div className="action-buttons">
                          {userItem.role_id === 2 ? (
                            <button
                              className="btn-demote"
                              onClick={() => changeUserRole(userItem.id, 1)}
                              disabled={loading}
                              title="Quitar permisos de administrador"
                            >
                              👤 Quitar Admin
                            </button>
                          ) : (
                            <button
                              className="btn-promote"
                              onClick={() => changeUserRole(userItem.id, 2)}
                              disabled={loading}
                              title="Dar permisos de administrador"
                            >
                              👑 Hacer Admin
                            </button>
                          )}
                          
                          <button
                            className="btn-delete"
                            onClick={() => deleteUser(userItem.id)}
                            disabled={loading}
                            title="Eliminar usuario permanentemente"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !loading && (
              <div className="empty-state">
                <p>No hay usuarios registrados en el sistema.</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal para crear usuario */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Crear Nuevo Usuario</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Contraseña:</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Nombre completo:</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Nombre del usuario"
                />
              </div>
              
              <div className="form-group">
                <label>Rol:</label>
                <select
                  value={newUser.role_id}
                  onChange={(e) => setNewUser({...newUser, role_id: parseInt(e.target.value)})}
                >
                  <option value={1}>👤 Usuario</option>
                  <option value={2}>👑 Administrador</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newUser.email_alerts}
                    onChange={(e) => setNewUser({...newUser, email_alerts: e.target.checked})}
                  />
                  📧 Recibir alertas por email
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newUser.daily_predictions}
                    onChange={(e) => setNewUser({...newUser, daily_predictions: e.target.checked})}
                  />
                  📊 Recibir predicciones diarias
                </label>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowCreateModal(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                className="btn-create"
                onClick={createUser}
                disabled={loading || !newUser.email || !newUser.password}
              >
                {loading ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 