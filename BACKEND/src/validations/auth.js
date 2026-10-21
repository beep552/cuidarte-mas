const yup = require("yup");
const { validarRut } = require("../utils/rut");
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } = require("../utils/password");

/**
 * Corrige:
 * - HAL-12: política de 6 caracteres sustituida por mínimo 12 con complejidad
 *   (3 de 4 categorías); el detalle se re-verifica en el handler mediante
 *   validarPoliticaContrasena, que además prohíbe contraseñas con el nombre
 *   de usuario.
 * - HAL-13: el RUT se valida por formato y dígito verificador (módulo 11).
 */
const esquemaContrasenaRegistro = yup
  .string()
  .required("La contraseña es requerida")
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  )
  .max(PASSWORD_MAX_LENGTH, `La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres`);

const loginSchema = yup.object().shape({
  nombre_usuario: yup
    .string()
    .required("El nombre de usuario es requerido")
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(50, "El nombre de usuario no puede exceder 50 caracteres"),
  password: yup
    .string()
    .required("La contraseña es requerida")
    .min(1, "La contraseña es requerida")
    .max(PASSWORD_MAX_LENGTH, `La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres`),
});

const registerSchema = yup.object().shape({
  nombre_usuario: yup
    .string()
    .required("El nombre de usuario es requerido")
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(50, "El nombre de usuario no puede exceder 50 caracteres"),
  password: esquemaContrasenaRegistro,
  correo: yup
    .string()
    .required("El correo es requerido")
    .email("El correo debe tener un formato válido")
    .max(255, "El correo no puede exceder 255 caracteres"),
  rut: yup
    .string()
    .optional()
    .test("rut-dv", function validarDigitoVerificador(valor) {
      if (valor == null) return true;
      const resultado = validarRut(valor);
      return (
        resultado.valido ||
        this.createError({ message: resultado.motivo || "El RUT no es válido" })
      );
    }),
});

module.exports = {
  loginSchema,
  registerSchema,
};
