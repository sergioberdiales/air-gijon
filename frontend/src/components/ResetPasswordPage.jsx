import { useState, useEffect } from 'react';
import { config } from '../config';
import './AuthModal.css'; // Reutilizar algunos estilos si es posible, o crear uno nuevo

function ResetPasswordPage({ token, onPasswordResetSuccess, onShowLogin }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token de reseteo no encontrado o inválido.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Token de reseteo no encontrado. No se puede continuar.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${config.API_BASE}/api/users/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(data.message || '¡Contraseña restablecida con éxito! Ahora puedes iniciar sesión.');
        // Opcional: llamar a onPasswordResetSuccess() que podría manejar el cierre o cambio de vista
        if (onPasswordResetSuccess) onPasswordResetSuccess();
      } else {
        setError(data.error || 'No se pudo restablecer la contraseña. El enlace podría haber expirado.');
      }
    } catch (err) {
      setError('Error de conexión al restablecer la contraseña. Inténtalo más tarde.');
    }
    setLoading(false);
  };

  if (!token && !error) { // Si no hay token y aún no hay error, podría ser un estado inicial antes de que useEffect lo detecte
    return <div className="auth-modal" style={{padding: '20px'}}>Verificando token...</div>;
  }
  
  // Si hay un error fundamental (como falta de token), solo mostrar el error.
  if (error && !success && (!newPassword && !confirmPassword)) { // Mostrar error si no hay token y no se ha intentado enviar nada
    return (
      <div className="auth-modal" style={{ margin: '50px auto', padding: '30px', maxWidth: '450px' }}>
        <div className="modal-header">
          <h2>Error al Restablecer Contraseña</h2>
        </div>
        <div className="error-message" style={{marginTop: '20px'}}>⚠️ {error}</div>
        {onShowLogin && (
            <button type="button" className="submit-btn" onClick={onShowLogin} style={{marginTop: '20px'}}>
              Ir a Iniciar Sesión
            </button>
        )}
      </div>
    );
  }

  return (
    <div className="auth-modal" style={{ margin: '50px auto', padding: '30px', maxWidth: '450px' }}>
      <div className="modal-header">
        <h2>Restablecer Contraseña</h2>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        <p style={{ marginBottom: '15px', textAlign: 'center', fontSize: '0.95em' }}>
          Ingresa tu nueva contraseña.
        </p>
        <div className="form-group">
          <label htmlFor="newPassword">Nueva Contraseña</label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmar Nueva Contraseña</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Repite la contraseña"
          />
        </div>
        
        {error && <div className="error-message">⚠️ {error}</div>}
        {success && <div className="success-message">✅ {success}</div>}

        {success ? (
          onShowLogin && (
            <button type="button" className="submit-btn" onClick={onShowLogin} style={{marginTop: '20px'}}>
              Ir a Iniciar Sesión
            </button>
          )
        ) : (
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Restableciendo...' : 'Restablecer Contraseña'}
          </button>
        )}
      </form>
    </div>
  );
}

export default ResetPasswordPage; 