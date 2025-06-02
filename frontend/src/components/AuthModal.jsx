import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { login, register } = useAuth();

  // Nuevos estados para el mensaje de confirmación
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  // Actualizar la pestaña activa cuando cambie initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Limpiar el formulario cuando se abre el modal con una pestaña específica
      setFormData({ email: '', password: '', name: '', confirmPassword: '' });
      setError('');
      setSuccess('');
      // Resetear el mensaje de confirmación al abrir/cambiar de pestaña
      setShowConfirmationMessage(false);
      setConfirmationEmail('');
    }
  }, [initialTab, isOpen]);

  // Estados del formulario
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Limpiar errores al escribir
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (activeTab === 'login') {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          setSuccess('¡Login exitoso!');
          setTimeout(() => {
            onClose();
            setFormData({ email: '', password: '', name: '', confirmPassword: '' });
            setShowConfirmationMessage(false);
          }, 1000);
        } else {
          setError(result.error);
        }
      } else {
        // Validaciones para registro
        if (formData.password !== formData.confirmPassword) {
          setError('Las contraseñas no coinciden');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }

        const result = await register(formData.email, formData.password, formData.name || null);
        
        if (result.success) {
          if (result.needsConfirmation) {
            // Mostrar mensaje de confirmación en lugar de cerrar el modal
            setSuccess('');
            setError('');
            setConfirmationEmail(result.email);
            setShowConfirmationMessage(true);
          } else {
            setSuccess('¡Registro exitoso! Ya puedes iniciar sesión.');
            setTimeout(() => {
              onClose();
              setFormData({ email: '', password: '', name: '', confirmPassword: '' });
            }, 1500);
          }
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      setError('Error de conexión. Inténtalo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
    setFormData({ email: '', password: '', name: '', confirmPassword: '' });
    setShowConfirmationMessage(false);
    setConfirmationEmail('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{showConfirmationMessage ? 'Revisa tu Correo' : (activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {showConfirmationMessage ? (
          <div className="confirmation-message-container">
            <div className="success-message" style={{ textAlign: 'center', padding: '20px' }}>
              <p>✅ ¡Registro casi completo!</p>
              <p>Hemos enviado un correo de confirmación a <strong>{confirmationEmail}</strong>.</p>
              <p>Por favor, revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace del correo para activar tu cuenta y poder iniciar sesión.</p>
              <button 
                onClick={onClose} 
                className="submit-btn" 
                style={{ marginTop: '20px' }}
              >
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button 
                className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => switchTab('login')}
              >
                Iniciar Sesión
              </button>
              <button 
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => switchTab('register')}
              >
                Registrarse
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {activeTab === 'register' && (
                <div className="form-group">
                  <label htmlFor="name">Nombre (opcional)</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Tu nombre"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="tu@email.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              {activeTab === 'register' && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    placeholder="Confirma tu contraseña"
                  />
                </div>
              )}

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div className="success-message">
                  ✅ {success}
                </div>
              )}

              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Procesando...' : (activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
              </button>
            </form>

            {activeTab === 'register' && (
              <div className="info-box">
                <h4>🔔 Beneficios de registrarse:</h4>
                <ul>
                  <li>Recibe alertas de calidad del aire por email</li>
                  <li>Predicciones diarias en tu bandeja de entrada</li>
                  <li>Configuración personalizada de notificaciones</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AuthModal; 