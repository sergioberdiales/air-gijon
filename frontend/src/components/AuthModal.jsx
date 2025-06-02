import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';
import { config } from '../config'; // Importar config para API_BASE

function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeView, setActiveView] = useState('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { login, register } = useAuth();

  // Nuevos estados para el mensaje de confirmación
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  // Estado para el formulario de "olvidé contraseña"
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  // Actualizar la pestaña activa cuando cambie initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveView('auth');
      setActiveTab(initialTab);
      setFormData({ email: '', password: '', name: '', confirmPassword: '' });
      setForgotPasswordEmail('');
      setError('');
      setSuccess('');
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

  const handleForgotPasswordEmailChange = (e) => {
    setForgotPasswordEmail(e.target.value);
    if (error) setError('');
  };

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${config.API_BASE}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess(data.message || 'Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.');
        setForgotPasswordEmail(''); // Limpiar campo tras éxito
      } else {
        setError(data.error || 'No se pudo procesar la solicitud. Inténtalo de nuevo.');
      }
    } catch (err) {
      setError('Error de conexión al solicitar reseteo. Inténtalo más tarde.');
    }
    setLoading(false);
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

  const switchToAuthView = (tab = 'login') => {
    setActiveView('auth');
    setActiveTab(tab);
    setError('');
    setSuccess('');
    setForgotPasswordEmail('');
    setFormData({ email: '', password: '', name: '', confirmPassword: '' });
    setShowConfirmationMessage(false);
  };

  if (!isOpen) return null;

  let modalTitle = '';
  if (showConfirmationMessage) {
    modalTitle = 'Revisa tu Correo';
  } else if (activeView === 'forgotPassword') {
    modalTitle = 'Restablecer Contraseña';
  } else {
    modalTitle = activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta';
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{modalTitle}</h2>
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
        ) : activeView === 'forgotPassword' ? (
          <form onSubmit={handleForgotPasswordRequest} className="auth-form">
            <p style={{ marginBottom: '15px', textAlign: 'center', fontSize: '0.95em' }}>
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div className="form-group">
              <label htmlFor="forgot-email">Email</label>
              <input
                type="email"
                id="forgot-email"
                name="forgot-email"
                value={forgotPasswordEmail}
                onChange={handleForgotPasswordEmailChange}
                required
                placeholder="tu@email.com"
              />
            </div>
            {error && <div className="error-message">⚠️ {error}</div>}
            {success && <div className="success-message">✅ {success}</div>}
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Enlace de Reseteo'}
            </button>
            <button 
              type="button" 
              className="link-btn" 
              onClick={() => switchToAuthView('login')} 
              style={{ marginTop: '15px' }}
            >
              &larr; Volver a Iniciar Sesión
            </button>
          </form>
        ) : (
          <>
            <div className="auth-tabs">
              <button 
                className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => switchToAuthView('login')}
              >
                Iniciar Sesión
              </button>
              <button 
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => switchToAuthView('register')}
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