import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState(null);

  // Verificar si es admin
  if (!user || user.role_name !== 'admin') {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <strong>Acceso denegado:</strong> Solo los administradores pueden acceder a esta página.
      </div>
    );
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Cargar estadísticas del dashboard
      const statsResponse = await fetch(`${config.API_BASE}/api/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Cargar lista de usuarios
      const usersResponse = await fetch(`${config.API_BASE}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users);
      }

      setError(null);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Error cargando datos de administración');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRoleId) => {
    try {
      const response = await fetch(`${config.API_BASE}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role_id: newRoleId }),
      });

      if (response.ok) {
        // Recargar usuarios
        loadAdminData();
        alert('Rol actualizado correctamente');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Error actualizando rol de usuario');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-4 text-gray-600">Cargando panel de administración...</span>
      </div>
    );
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadge = (roleName) => {
    return roleName === 'admin' ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        👑 Admin
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        👤 Usuario
      </span>
    );
  };

  const getConfirmationBadge = (isConfirmed) => {
    return isConfirmed ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        ✅ Confirmado
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        ⏳ Pendiente
      </span>
    );
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
        {activeTab === 'dashboard' && stats && (
          <div className="dashboard-content">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-number">{stats.total_users}</div>
                  <div className="stat-label">Total Usuarios</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <div className="stat-number">{stats.confirmed_users}</div>
                  <div className="stat-label">Usuarios Confirmados</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🆕</div>
                <div className="stat-content">
                  <div className="stat-number">{stats.new_users_today}</div>
                  <div className="stat-label">Nuevos Hoy</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">👑</div>
                <div className="stat-content">
                  <div className="stat-number">{stats.admin_users}</div>
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
                onClick={loadAdminData}
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
                                onClick={() => updateUserRole(user.id, 2)}
                                disabled={loading}
                              >
                                👑 Hacer Admin
                              </button>
                            ) : (
                              <button
                                className="action-button demote"
                                onClick={() => updateUserRole(user.id, 1)}
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