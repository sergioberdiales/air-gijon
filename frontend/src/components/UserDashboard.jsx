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

  return (
    <div className="page-container">
      {/* Header de página simplificado */}
      <div className="page-header" style={{ padding: '20px 0', marginBottom: '30px' }}>
        <div className="header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '600', color: '#2d3748' }}>Mi Cuenta</h1>
            <p style={{ margin: '5px 0 0 0', color: '#718096' }}>Gestiona tus preferencias y configuración</p>
          </div>
          <button onClick={logout} className="btn btn-secondary">
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="content-wrapper" style={{ maxWidth: '800px', margin: '0 auto', gap: '30px', display: 'flex', flexDirection: 'column' }}>
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
            <div className="account-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
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

              {/* Nueva opción: Eliminar Cuenta */}
              <div className="stat-item" style={{ cursor: 'pointer' }} onClick={openDeleteModal}>
                <div className="stat-icon" style={{ backgroundColor: '#fee', color: '#dc2626' }}>
                  <Trash2 size={20} />
                </div>
                <div className="stat-content">
                  <label>Eliminar Cuenta</label>
                  <span style={{ color: '#dc2626', fontWeight: '500' }}>Eliminar permanentemente</span>
                </div>
              </div>
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