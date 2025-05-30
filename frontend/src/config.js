// Configuración de la aplicación
export const config = {
  API_BASE: import.meta.env.PROD 
    ? 'https://air-gijon.onrender.com'
    : 'http://localhost:3000',
  
  API_ENDPOINTS: {
    AIR_QUALITY: '/api/air/constitucion/pm25',
    EVOLUTION: '/api/air/constitucion/evolucion',
    USER_LOGIN: '/api/users/login',
    USER_REGISTER: '/api/users/register',
    USER_PROFILE: '/api/users/profile',
    USER_PREFERENCES: '/api/users/preferences',
    USER_DASHBOARD: '/api/users/dashboard'
  }
}; 