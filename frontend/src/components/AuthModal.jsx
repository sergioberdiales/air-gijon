import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { login, register } = useAuth();

  // Actualizar la pestaña activa cuando cambie initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      // Limpiar el formulario cuando se abre el modal con una pestaña específica
      setFormData({ email: '', password: '', name: '', confirmPassword: '' });
      setError('');
      setSuccess('');
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
          setSuccess('¡Registro exitoso! Ya puedes configurar tus preferencias.');
          setTimeout(() => {
            onClose();
            setFormData({ email: '', password: '', name: '', confirmPassword: '' });
          }, 1500);
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
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

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
      </div>
    </div>
  );
}

export default AuthModal; 