import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { esRolAdmin } from '../utils/roles'

/**
 * HAL-35: los guards aceptan ambos nombres del rol admin ("admin" y
 * "administrador"), igual que el backend. La normalización vive en un
 * único lugar (utils/roles.js) y aquí no se duplica la lógica entre
 * componentes.
 */

export function RequireAuth({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export function RequireAdmin({ children }) {
  const { role } = useAuth()
  if (!esRolAdmin(role)) return <div>No autorizado (solo administrador).</div>
  return children
}

export function RequireMedico({ children }) {
  const { role } = useAuth()
  if (!esRolAdmin(role) && role !== 'medico') {
    return <div>No autorizado (solo médico o administrador).</div>
  }
  return children
}

export function RequireAdminOrOwnUser({ children }) {
  const { role, user } = useAuth()
  const { id } = useParams()

  // Si es administrador, permitir acceso
  if (esRolAdmin(role)) return children

  // Si es otro rol, solo permitir si está editando su propio usuario
  if (user?.usuarioId && id && Number(user.usuarioId) === Number(id)) {
    return children
  }

  // No autorizado
  return <div>No autorizado. Solo puedes editar tu propio usuario.</div>
}
