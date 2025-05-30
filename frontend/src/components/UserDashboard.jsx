import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

function UserDashboard() {
  const { user, logout, updatePreferences } = useAuth();
  const [preferences, setPreferences] = useState({
    email_alerts: false,
    daily_predictions: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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

    // Limpiar mensaje después de 3 segundos
    setTimeout(() => setMessage(''), 3000);
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
        <button onClick={logout} className="logout-btn">
          Cerrar Sesión
        </button>
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
    </div>
  );
}

export default UserDashboard; 