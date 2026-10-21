import * as yup from "yup";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validarPoliticaContrasena,
} from "../../utils/passwordPolicy";

export const updateUsuarioSchema = yup.object().shape({
  correo: yup
    .string()
    .required("El correo es requerido")
    .email("El correo debe tener un formato válido")
    .max(255, "El correo no puede exceder 255 caracteres"),
});

export const updatePasswordSchema = yup.object().shape({
  contrasena_hash: yup
    .string()
    .required("La contraseña es requerida")
    .min(
      PASSWORD_MIN_LENGTH,
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`
    )
    .max(PASSWORD_MAX_LENGTH, `La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres`)
    .test(
      "politica-contrasena",
      "La contraseña no cumple la política del sistema",
      function (value) {
        const errores = validarPoliticaContrasena(value);
        if (errores.length > 0) {
          return this.createError({ message: errores.join(". ") });
        }
        return true;
      }
    ),
  confirmar_contrasena: yup
    .string()
    .required("Debe confirmar la contraseña")
    .oneOf([yup.ref("contrasena_hash")], "Las contraseñas no coinciden"),
});
