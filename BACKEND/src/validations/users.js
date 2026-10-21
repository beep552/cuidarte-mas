const yup = require("yup");
const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } = require("../utils/password");

/**
 * Corrige HAL-21: `updateUserSchema` ahora declara `rol_id` explícitamente
 * (antes el campo quedaba fuera del esquema y, combinado con el middleware
 * que no reasignaba el objeto validado, permitía escalamiento de rol vía
 * PUT /usuarios/:id). El middleware `validate` reasigna el objeto validado,
 * de modo que el handler sólo recibe campos declarados.
 * Corrige HAL-12: los "6 caracteres" pasan a la política fuerte.
 */

const campoContrasena = yup
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
  )
  .max(PASSWORD_MAX_LENGTH, `La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres`);

const createUserSchema = yup.object().shape({
  nombre_usuario: yup
    .string()
    .required("El nombre de usuario es requerido")
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(50, "El nombre de usuario no puede exceder 50 caracteres"),
  // Contraseña en claro que el backend hashea (HAL-02); el nombre se mantiene
  // por compatibilidad con los formularios existentes.
  contrasena_hash: campoContrasena.required("La contraseña es requerida"),
  correo: yup
    .string()
    .required("El correo es requerido")
    .email("El correo debe tener un formato válido")
    .max(255, "El correo no puede exceder 255 caracteres"),
  rol_id: yup
    .number()
    .integer("El ID del rol debe ser un número entero")
    .positive("El ID del rol debe ser positivo")
    .optional(),
});

const updateUserSchema = yup.object().shape({
  nombre_usuario: yup
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(50, "El nombre de usuario no puede exceder 50 caracteres")
    .optional(),
  contrasena_hash: campoContrasena.optional(),
  correo: yup
    .string()
    .email("El correo debe tener un formato válido")
    .max(255, "El correo no puede exceder 255 caracteres")
    .optional(),
  rol_id: yup
    .number()
    .integer()
    .positive()
    .optional()
    .nullable(),
}).test(
  "at-least-one-field",
  "Debe proporcionar al menos un campo para actualizar",
  function (value = {}) {
    return Object.keys(value).length > 0;
  }
);

module.exports = {
  createUserSchema,
  updateUserSchema,
};
