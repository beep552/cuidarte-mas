/**
 * Normalización y validación de RUT chileno.
 *
 * Corrige HAL-13: antes solo se quitaban los puntos y se validaba el formato
 * por expresión regular. Ahora se normaliza (trim, sin puntos, K -> k) y se
 * valida el dígito verificador con el algoritmo módulo 11.
 */

/**
 * Normaliza un RUT: quita espacios, puntos y guion interno, y deja
 * un string con separación "cuerpo-dv" (minúscula). Ejemplos:
 *   " 12.345.678-k " -> "12345678-k"
 *   "1,234,567-8" no es formato chileno, y devuelve el valor tal cual.
 */
function normalizeRut(rut) {
  if (!rut || typeof rut !== "string") return rut;
  return rut.trim().replace(/\./g, "").replace(/[Kk]/g, (m) => m.toLowerCase());
}

/** Calcula el dígito verificador (módulo 11) para un cuerpo de RUT numérico. */
function calcularDigitoVerificador(cuerpo) {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number.parseInt(cuerpo[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = suma % 11;
  const dv = 11 - resto;
  if (dv === 11) return "0";
  if (dv === 10) return "k";
  return String(dv);
}

/**
 * Valida que el RUT tenga formato válido y que el dígito verificador
 * (módulo 11) sea correcto. Acepta variantes con/sin puntos y k mayúscula.
 * @returns {{ valido: boolean, motivo?: string }}
 */
function validarRut(rut) {
  if (!rut || typeof rut !== "string") {
    return { valido: false, motivo: "El RUT es requerido" };
  }
  const normalizado = normalizeRut(rut);
  const coincidencia = /^(\d{1,8})-([\dk])$/.exec(normalizado);
  if (!coincidencia) {
    return {
      valido: false,
      motivo: "El RUT debe tener el formato 12345678-9 (con o sin puntos, dv 0-9 o k)",
    };
  }
  const [, cuerpo, dv] = coincidencia;
  if (cuerpo.split("").every((c) => c === cuerpo[0]) && cuerpo.length === 8) {
    // Rechaza cuerpos tipo 11111111, 22222222, etc. (todos los dígitos iguales).
    return { valido: false, motivo: "El RUT no puede tener todos los dígitos iguales" };
  }
  const dvCalculado = calcularDigitoVerificador(cuerpo);
  if (dvCalculado !== dv) {
    return {
      valido: false,
      motivo: "El dígito verificador del RUT no es válido",
    };
  }
  return { valido: true };
}

module.exports = {
  normalizeRut,
  calcularDigitoVerificador,
  validarRut,
};
