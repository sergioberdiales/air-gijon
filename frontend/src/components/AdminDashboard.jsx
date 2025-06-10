import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Función para cambiar rol de usuario
  const changeUserRole = async (userId, newRoleId) => {
    console.log('🔄 Cambiando rol:', { userId, newRoleId });
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
        // Recargar lista de usuarios
        fetchUsers();
      } else {
        const errorText = await response.text();
        console.error('❌ Error cambiando rol:', errorText);
        setError('Error cambiando rol de usuario');
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión');
    }
  };

  // Función para eliminar usuario
  const deleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }
    
    console.log('🗑️ Eliminando usuario:', userId);
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
        // Recargar lista de usuarios
        fetchUsers();
      } else {
        const errorText = await response.text();
        console.error('❌ Error eliminando usuario:', errorText);
        setError('Error eliminando usuario');
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión');
    }
  };

  // Función para gestionar notificaciones
  const toggleNotifications = async (userId, currentEmailAlerts, currentDailyPredictions) => {
    const newEmailAlerts = !currentEmailAlerts;
    const newDailyPredictions = !currentDailyPredictions;
    
    console.log('🔔 Gestionando notificaciones:', { 
      userId, 
      emailAlerts: newEmailAlerts, 
      dailyPredictions: newDailyPredictions 
    });
    
    try {
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}/notifications`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email_alerts: newEmailAlerts,
          daily_predictions: newDailyPredictions
        })
      });

      console.log('📊 Notifications response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Notificaciones actualizadas exitosamente:', data);
        // Recargar lista de usuarios
        fetchUsers();
      } else {
        const errorText = await response.text();
        console.error('❌ Error actualizando notificaciones:', errorText);
        setError('Error actualizando notificaciones');
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      setError('Error de conexión');
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
            <h2>Usuarios Registrados</h2>
            <button 
              className="refresh-button"
              onClick={fetchUsers}
              disabled={loading}
            >
              🔄 Actualizar
            </button>
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
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name || 'Sin nombre'}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${user.role_id === 2 ? 'admin' : 'user'}`}>
                          {user.role_id === 2 ? '👑 Admin' : '👤 Usuario'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.is_confirmed ? 'confirmed' : 'pending'}`}>
                          {user.is_confirmed ? '✅ Confirmado' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td>
                        <div className="notifications-cell">
                          <span className={`notification-badge ${user.email_alerts ? 'enabled' : 'disabled'}`}>
                            📧 {user.email_alerts ? 'Sí' : 'No'}
                          </span>
                          <span className={`notification-badge ${user.daily_predictions ? 'enabled' : 'disabled'}`}>
                            📊 {user.daily_predictions ? 'Sí' : 'No'}
                          </span>
                        </div>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString('es-ES')}</td>
                      <td>
                        <div className="action-buttons">
                          {user.role_id === 2 ? (
                            <button
                              className="btn-demote"
                              onClick={() => changeUserRole(user.id, 1)}
                              disabled={loading}
                              title="Quitar permisos de administrador"
                            >
                              👤 Quitar Admin
                            </button>
                          ) : (
                            <button
                              className="btn-promote"
                              onClick={() => changeUserRole(user.id, 2)}
                              disabled={loading}
                              title="Dar permisos de administrador"
                            >
                              👑 Hacer Admin
                            </button>
                          )}
                          
                          <button
                            className="btn-notifications"
                            onClick={() => toggleNotifications(user.id, user.email_alerts, user.daily_predictions)}
                            disabled={loading}
                            title="Activar/Desactivar todas las notificaciones"
                          >
                            🔔 {(user.email_alerts || user.daily_predictions) ? 'Desactivar' : 'Activar'}
                          </button>
                          
                          <button
                            className="btn-delete"
                            onClick={() => deleteUser(user.id)}
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
    </div>
  );
};

export default AdminDashboard; 