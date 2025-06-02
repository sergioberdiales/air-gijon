import { createContext, useContext, useState, useEffect } from 'react';
import { config } from '../config'; // Importar config

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('authToken'));

  // Usar API_BASE desde config
  const API_BASE = config.API_BASE;

  // Verificar si hay un token válido al cargar
  useEffect(() => {
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token inválido, limpiar
        logout();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Error de login' };
      }
    } catch (error) {
      console.error('Error during login:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const register = async (email, password, name) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('authToken', data.token);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || 'Error de registro' };
      }
    } catch (error) {
      console.error('Error during registration:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const updatePreferences = async (preferences) => {
    try {
      const response = await fetch(`${API_BASE}/api/users/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
      });

      const data = await response.json();

      if (response.ok) {
        // Actualizar el usuario con las preferencias devueltas por el backend
        setUser(prev => ({ 
          ...prev, 
          email_alerts: data.preferences.email_alerts,
          daily_predictions: data.preferences.daily_predictions
        }));
        return { success: true, preferences: data.preferences };
      } else {
        return { success: false, error: data.error || 'Error actualizando preferencias' };
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updatePreferences,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 