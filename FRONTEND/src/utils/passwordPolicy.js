/**
 * HAL-12: política de contraseñas común para frontend (alineada con
 * BACKEND/src/utils/password.js): mínimo 12 caracteres y 3 de 4 categorías
 * (minúsculas, mayúsculas, números, símbolos).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function validarPoliticaContrasena(password) {
  const errores = [];
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    errores.push(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  }
  if (typeof password === "string" && password.length > PASSWORD_MAX_LENGTH) {
    errores.push(`La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres`);
  }
  if (typeof password === "string") {
    const categorias = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
    if (categorias < 3) {
      errores.push(
        "Debe incluir al menos 3 de estas categorías: minúsculas, mayúsculas, números y símbolos"
      );
    }
  }
  return errores;
}
