import axios from 'axios'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4444'

export const api = axios.create({
  baseURL: API_URL,
})

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

// Interceptor para agregar el token automáticamente a todas las peticiones (excepto login y registro)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    const url = config.url || ''

    // Rutas públicas que no requieren token
    const isLogin = url.includes('/autenticacion/login')
    // El registro es POST a /empresas cuando no hay token (usuario nuevo)
    const isRegister = url.includes('/empresas') &&
                       config.method?.toLowerCase() === 'post' &&
                       !token
    // Rutas públicas de contratos compartidos
    const isPublicContract = url.includes('/public/contratos')

    // Si no es login, registro ni ruta pública, agregar el token si existe
    if (!isLogin && !isRegister && !isPublicContract && token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * HAL-38: manejo central de sesiones vencidas.
 * Un 401 fuera del login limpia el estado local y redirige a /login con
 * aviso de expiración, una sola vez (evita bucles con múltiples 401
 * simultáneos). Un 403 se mantiene como toast de "sin permiso" sin logout.
 */
function finalizarSesionExpired() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  delete api.defaults.headers.common.Authorization
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login?expired=1')
  }
}

// Interceptor para manejar errores y mostrar toasts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = typeof error.config?.url === 'string' &&
      error.config.url.includes('/autenticacion/login')

    // HAL-38: sesión inválida/expirada -> limpieza y redirección única.
    if (error.response?.status === 401 && !isLoginRequest) {
      finalizarSesionExpired()
      toast.error('La sesión ha expirado', {
        description: 'Vuelve a iniciar sesión para continuar.',
        duration: 5000,
      })
      return Promise.reject(error)
    }

    if (error.response) {
      const { data } = error.response

      // Si el error tiene el formato esperado { error, glosa }
      if (data && data.error && data.glosa) {
        toast.error(data.error, {
          description: data.glosa,
          duration: 5000,
        })
      } else if (data && data.error) {
        // Si solo hay error sin glosa
        toast.error(data.error)
      } else if (data && data.message) {
        // Si hay un mensaje genérico
        toast.error(data.message)
      } else {
        // Mensaje de error genérico
        toast.error(
          `Error: ${error.response.status} - ${error.response.statusText || 'Error en la petición'}`
        )
      }
    } else if (error.request) {
      // Error de red (sin respuesta del servidor)
      toast.error('Error de conexión. Verifica tu conexión a internet.')
    } else {
      // Otro tipo de error
      toast.error(error.message || 'Ocurrió un error inesperado')
    }

    // Rechazar la promesa para que el código que llama pueda manejarla si lo necesita
    return Promise.reject(error)
  }
)
