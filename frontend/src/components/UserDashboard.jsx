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
    console.log('UserDashboard: user data received:', user);
    if (user) {
      console.log('UserDashboard: email_alerts =', user.email_alerts);
      console.log('UserDashboard: daily_predictions =', user.daily_predictions);
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

  return (
    <div className="page-container">
      {/* Contenido principal sin header de saludo */}
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
              {/* Debug info */}
              <div style={{ background: '#f0f0f0', padding: '10px', marginBottom: '20px', fontSize: '12px' }}>
                <strong>DEBUG:</strong><br/>
                User object: {JSON.stringify(user, null, 2)}<br/>
                Email alerts: {user?.email_alerts?.toString()}<br/>
                Daily predictions: {user?.daily_predictions?.toString()}<br/>
                Preferences state: {JSON.stringify(preferences, null, 2)}
              </div>

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

            {/* Botón para eliminar cuenta */}
            <div className="danger-zone" style={{ marginTop: '40px', padding: '20px', border: '1px solid #ff6b6b', borderRadius: '8px', backgroundColor: '#fff5f5' }}>
              <h3 style={{ color: '#d63031', marginBottom: '10px' }}>Zona de Peligro</h3>
              <p style={{ marginBottom: '15px', color: '#636e72' }}>
                Esta acción eliminará permanentemente tu cuenta y todos los datos asociados.
              </p>
              <button onClick={openDeleteModal} className="btn btn-danger">
                <Trash2 size={18} />
                Eliminar Cuenta
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

              {user?.last_login && (
                <div className="stat-item">
                  <div className="stat-icon">
                    <Clock size={20} />
                  </div>
                  <div className="stat-content">
                    <label>Último acceso</label>
                    <span>
                      {new Date(user.last_login).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="account-actions">
              <button onClick={logout} className="btn btn-secondary">
                <LogOut size={18} />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {/* Modal de eliminación de cuenta */}
        {showDeleteModal && (
          <Modal onClose={closeDeleteModal}>
            <div className="modal-header">
              <h2>⚠️ Confirmar Eliminación de Cuenta</h2>
            </div>
            <div className="modal-content">
              <p>
                <strong>¿Estás seguro de que quieres eliminar tu cuenta?</strong>
              </p>
              <p>
                Esta acción es <strong>irreversible</strong> y eliminará permanentemente:
              </p>
              <ul>
                <li>Tu perfil de usuario</li>
                <li>Tus preferencias de notificación</li>
                <li>Todo el historial asociado a tu cuenta</li>
              </ul>
              
              {deleteError && (
                <div className="error-message">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                onClick={closeDeleteModal} 
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteAccount} 
                className="btn btn-danger"
                disabled={isDeleting}
              >
                <Trash2 size={18} />
                {isDeleting ? 'Eliminando...' : 'Eliminar Permanentemente'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default UserDashboard; 