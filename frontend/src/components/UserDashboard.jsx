import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    setMessage('');

    try {
      const result = await updatePreferences(preferences);
      if (result.success) {
        setMessage('✅ Preferencias actualizadas correctamente');
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      setMessage('❌ Error al guardar preferencias');
    } finally {
      setLoading(false);
    }

    setTimeout(() => setMessage(''), 3000);
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

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h2>{getWelcomeMessage()}, {user?.name || 'Usuario'}</h2>
          <p className="user-email">{user?.email}</p>
          <span className="user-badge">
            {user?.role === 'manager' ? '👑 Gestor' : '👤 Usuario'}
          </span>
        </div>
        <div className="dashboard-header-actions">
          <button onClick={logout} className="logout-btn">
            Cerrar Sesión
          </button>
          <button onClick={openDeleteModal} className="delete-account-btn">
            Eliminar Cuenta
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="preferences-section">
          <h3>🔔 Configuración de Notificaciones</h3>
          <p className="section-description">
            Personaliza cómo quieres recibir información sobre la calidad del aire en Gijón.
          </p>

          <div className="preference-options">
            <div className="preference-item">
              <div className="preference-info">
                <h4>🚨 Alertas de Calidad del Aire</h4>
                <p>Recibe notificaciones por email cuando los niveles de contaminación sean preocupantes</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.email_alerts}
                  onChange={() => handlePreferenceChange('email_alerts')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>📈 Predicciones Diarias</h4>
                <p>Recibe cada mañana las predicciones de calidad del aire para el día</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.daily_predictions}
                  onChange={() => handlePreferenceChange('daily_predictions')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {message && (
            <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <button 
            onClick={handleSavePreferences}
            className="save-btn"
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar Preferencias'}
          </button>
        </div>

        <div className="account-info">
          <h3>📊 Información de la Cuenta</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Email:</label>
              <span>{user?.email}</span>
            </div>
            <div className="info-item">
              <label>Tipo de cuenta:</label>
              <span>{user?.role === 'manager' ? 'Gestor' : 'Usuario Externo'}</span>
            </div>
            <div className="info-item">
              <label>Miembro desde:</label>
              <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Último acceso:</label>
              <span>{user?.last_login ? new Date(user.last_login).toLocaleDateString('es-ES') : 'Primer acceso'}</span>
            </div>
          </div>
        </div>

        {user?.role === 'manager' && (
          <div className="manager-section">
            <h3>👑 Panel de Gestión</h3>
            <p>Como gestor, tienes acceso a herramientas adicionales de administración.</p>
            <div className="manager-actions">
              <button className="action-btn">
                📈 Ver Métricas del Modelo
              </button>
              <button className="action-btn">
                📧 Probar Sistema de Emails
              </button>
              <button className="action-btn">
                👥 Gestionar Usuarios
              </button>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <Modal isOpen={showDeleteModal} onClose={closeDeleteModal} title="Confirmar Eliminación de Cuenta">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            ¿Estás seguro de que deseas eliminar tu cuenta permanentemente? Esta acción no se puede deshacer y todos tus datos asociados se perderán.
          </p>
          {deleteError && <p className="text-red-500 text-sm mb-3">{deleteError}</p>}
          <div className="flex justify-end space-x-3">
            <button
              onClick={closeDeleteModal}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
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