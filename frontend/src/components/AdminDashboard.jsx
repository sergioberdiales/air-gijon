import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Verificar si es admin
  if (!user || user.role_name !== 'admin') {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <strong>Acceso denegado:</strong> Solo los administradores pueden acceder a esta página.
      </div>
    );
  }

  // Función para obtener datos del dashboard
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        setError('Error cargando dashboard');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener lista de usuarios
  const fetchUsers = async () => {
    try {
      setLoading(true);
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
  };

  // Función para cambiar rol de usuario
  const changeUserRole = async (userId, newRoleId) => {
    try {
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role_id: newRoleId })
      });

      if (response.ok) {
        // Recargar lista de usuarios para reflejar cambios
        fetchUsers();
        // También recargar dashboard para actualizar contadores
        fetchDashboardData();
      } else {
        setError('Error cambiando rol de usuario');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  // Cargar datos según la pestaña activa
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserRoleInfo = (user) => {
    const isAdmin = user.role_id === 2;
    return {
      isAdmin,
      label: isAdmin ? 'Admin' : 'Usuario',
      icon: isAdmin ? '👑' : '👤',
      className: isAdmin ? 'role-admin' : 'role-user'
    };
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Panel de Administración</h1>
        <p>Gestión del sistema Air Gijón</p>
      </div>

      {/* Navegación por pestañas */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Usuarios
        </button>
      </div>

      {/* Contenido */}
      <div className="admin-content">
        {loading && (
          <div className="loading-message">
            <div className="spinner"></div>
            Cargando...
          </div>
        )}
        
        {error && (
          <div className="error-message">
            ❌ {error}
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && dashboardData && (
          <div className="dashboard-content">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-number">{dashboardData.total_users}</div>
                  <div className="stat-label">Total Usuarios</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-number">{dashboardData.confirmed_users}</div>
                  <div className="stat-label">Usuarios Confirmados</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🆕</div>
                <div className="stat-content">
                  <div className="stat-number">{dashboardData.new_users_today}</div>
                  <div className="stat-label">Nuevos Hoy</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">👑</div>
                <div className="stat-content">
                  <div className="stat-number">{dashboardData.admin_count}</div>
                  <div className="stat-label">Administradores</div>
                </div>
              </div>
            </div>

            <div className="system-info">
              <h3>Información del Sistema</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Estado del Sistema</span>
                  <span className="info-value status-active">🟢 Operativo</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Última Actualización</span>
                  <span className="info-value">{formatDate(new Date())}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-content">
            <div className="users-header">
              <h3>Gestión de Usuarios</h3>
              <p>Lista de todos los usuarios registrados y sus roles.</p>
              <button 
                className="refresh-button"
                onClick={fetchUsers}
                disabled={loading}
              >
                🔄 Actualizar
              </button>
            </div>

            {users.length > 0 ? (
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Estado</th>
                      <th>Rol</th>
                      <th>Registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const roleInfo = getUserRoleInfo(user);
                      return (
                        <tr key={user.id} className="user-row">
                          <td className="user-info">
                            <div className="user-avatar">
                              {user.name ? user.name.charAt(0).toUpperCase() : '👤'}
                            </div>
                            <div className="user-details">
                              <div className="user-name">{user.name || 'Sin nombre'}</div>
                              <div className="user-email">{user.email}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${user.is_confirmed ? 'confirmed' : 'pending'}`}>
                              {user.is_confirmed ? '✅ Confirmado' : '⏳ Pendiente'}
                            </span>
                          </td>
                          <td>
                            <span className={`role-badge ${roleInfo.className}`}>
                              {roleInfo.icon} {roleInfo.label}
                            </span>
                          </td>
                          <td className="date-cell">
                            {formatDate(user.created_at)}
                          </td>
                          <td>
                            {!roleInfo.isAdmin ? (
                              <button
                                className="action-button promote"
                                onClick={() => changeUserRole(user.id, 2)}
                                disabled={loading}
                              >
                                👑 Hacer Admin
                              </button>
                            ) : (
                              <button
                                className="action-button demote"
                                onClick={() => changeUserRole(user.id, 1)}
                                disabled={loading}
                              >
                                👤 Quitar Admin
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No hay usuarios</h3>
                <p>No se encontraron usuarios en el sistema.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 