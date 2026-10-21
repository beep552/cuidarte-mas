/**
 * HAL-35: normalización de comprobaciones de rol para los guards y la UI.
 * Vive en un archivo propio (no en un componente) para poder compartirse
 * entre módulos sin romper el fast-refresh de react-refresh/eslint.
 */
export function esRolAdmin(role) {
  return role === 'admin' || role === 'administrador'
}
