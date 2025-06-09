import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Save, User, Mail, Calendar, Clock, LogOut, Trash2, Shield, Bell, TrendingUp } from 'lucide-react';
import Modal from './Modal';
import { config } from '../config';

function UserDashboard() {
  const { user, logout, updatePreferences, token } = useAuth();
  const [preferences, setPreferences] = useState({
    email_alerts: false,
    daily_predictions: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setPreferences({
        email_alerts: user.email_alerts || false,
        daily_predictions: user.daily_predictions || false
      });
    }
  }, [user]);

  const handlePreferenceChange = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSaved(false);
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await updatePreferences(preferences);
      if (result.success) {
        setMessage('Preferencias actualizadas correctamente');
        setSaved(true);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.error);
        setSaved(false);
      }
    } catch (error) {
      setMessage('Error al guardar preferencias');
      setSaved(false);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`${config.API_BASE}/api/users/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowDeleteModal(false);
        alert('Tu cuenta ha sido eliminada exitosamente.');
        logout();
      } else {
        setDeleteError(data.error || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
      }
    } catch (err) {
      console.error('Error eliminando cuenta:', err);
      setDeleteError('Error de conexión al intentar eliminar la cuenta.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Buenos días';
    if (hour < 18) return '☀️ Buenas tardes';
    return '🌙 Buenas noches';
  };

  const getUserDisplayName = () => {
    if (user?.name && user.name.trim()) {
      return user.name.trim();
    }
    if (user?.email) {
      // Extraer la parte local del email como nombre de fallback
      return user.email.split('@')[0];
    }
    return 'Usuario';
  };

  return (
    <div className="page-container">
      {/* Header Principal */}
      <div className="page-header">
        <div className="header-content">
          <div className="welcome-section">
            <h1 className="page-title">
              {getWelcomeMessage()}, {getUserDisplayName()}
            </h1>
            <div className="user-info">
              <div className="user-email">
                <Mail size={16} />
                <span>{user?.email || 'Email no disponible'}</span>
              </div>
              <div className="user-role">
                {user?.role === 'manager' ? (
                  <>
                    <Shield size={16} />
                    <span className="role-badge manager">Usuario Gestor</span>
                  </>
                ) : (
                  <>
                    <User size={16} />
                    <span className="role-badge external">Usuario Externo</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={logout} className="btn btn-secondary">
              <LogOut size={18} />
              Cerrar Sesión
            </button>
            <button onClick={openDeleteModal} className="btn btn-danger">
              <Trash2 size={18} />
              Eliminar Cuenta
            </button>
          </div>
        </div>
      </div>

      <div className="content-wrapper">
        {/* Configuración de Notificaciones */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Bell size={24} />
              <h2>Configuración de Notificaciones</h2>
            </div>
            <p className="card-description">
              Personaliza cómo quieres recibir información sobre la calidad del aire en Gijón.
            </p>
          </div>

          <div className="card-content">
            <div className="notification-settings">
              {/* Alertas de Calidad del Aire */}
              <div className="setting-item">
                <div className="setting-icon danger">
                  🚨
                </div>
                <div className="setting-content">
                  <h3>Alertas de Calidad del Aire</h3>
                  <p>Recibe notificaciones por email cuando los niveles de contaminación sean preocupantes</p>
                </div>
                <div className="setting-toggle">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={preferences.email_alerts}
                      onChange={() => handlePreferenceChange('email_alerts')}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              {/* Predicciones Diarias */}
              <div className="setting-item">
                <div className="setting-icon primary">
                  📈
                </div>
                <div className="setting-content">
                  <h3>Predicciones Diarias</h3>
                  <p>Recibe cada mañana las predicciones de calidad del aire para el día</p>
                </div>
                <div className="setting-toggle">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={preferences.daily_predictions}
                      onChange={() => handlePreferenceChange('daily_predictions')}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Botón Guardar */}
            <div className="save-section">
              {message && (
                <div className={`message ${message.includes('correctamente') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}

              <button 
                onClick={handleSavePreferences}
                className={`btn btn-primary save-btn ${saved ? 'saved' : ''} ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                <Save size={18} />
                {loading ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Preferencias'}
              </button>
            </div>
          </div>
        </div>

        {/* Información de la Cuenta */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <User size={24} />
              <h2>Información de la Cuenta</h2>
            </div>
          </div>

          <div className="card-content">
            <div className="account-stats">
              <div className="stat-item">
                <div className="stat-icon">
                  <Mail size={20} />
                </div>
                <div className="stat-content">
                  <label>Email</label>
                  <span>{user?.email || 'No disponible'}</span>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <Shield size={20} />
                </div>
                <div className="stat-content">
                  <label>Tipo de cuenta</label>
                  <span>{user?.role === 'manager' ? 'Usuario Gestor' : 'Usuario Externo'}</span>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <Calendar size={20} />
                </div>
                <div className="stat-content">
                  <label>Miembro desde</label>
                  <span>
                    {user?.created_at 
                      ? new Date(user.created_at).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>

              <div className="stat-item">
                <div className="stat-icon">
                  <Clock size={20} />
                </div>
                <div className="stat-content">
                  <label>Último acceso</label>
                  <span>
                    {user?.last_login 
                      ? new Date(user.last_login).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Primer acceso'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Gestión (solo para managers) */}
        {user?.role === 'manager' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Shield size={24} />
                <h2>Panel de Gestión</h2>
              </div>
              <p className="card-description">
                Como gestor, tienes acceso a herramientas adicionales de administración.
              </p>
            </div>

            <div className="card-content">
              <div className="manager-actions">
                <button className="btn btn-outline">
                  <TrendingUp size={18} />
                  Ver Métricas del Modelo
                </button>
                <button className="btn btn-outline">
                  <Mail size={18} />
                  Probar Sistema de Emails
                </button>
                <button className="btn btn-outline">
                  <User size={18} />
                  Gestionar Usuarios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <Modal isOpen={showDeleteModal} onClose={closeDeleteModal} title="Confirmar Eliminación de Cuenta">
          <p className="modal-text">
            ¿Estás seguro de que deseas eliminar tu cuenta permanentemente? Esta acción no se puede deshacer y todos tus datos asociados se perderán.
          </p>
          {deleteError && (
            <div className="message error">
              {deleteError}
            </div>
          )}
          <div className="modal-actions">
            <button
              onClick={closeDeleteModal}
              disabled={isDeleting}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="btn btn-danger"
            >
              {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Mi Cuenta'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default UserDashboard; 