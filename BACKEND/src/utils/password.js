/**
 * Hashing de contraseñas con scrypt (módulo nativo `crypto` de Node).
 *
 * Corrige HAL-02 (contraseñas en texto plano) y HAL-12 (política débil).
 * - Formato almacenado: `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`
 * - N cálculo costoso (2^15) para usar el módulo nativo en lugar de bcrypt/argon2,
 *   evitando nuevas dependencias. Parámetros equivalentes o superiores a OWASP 2024:
 *   N=32768, r=8, p=1 (ver recommendation de OWASP Password Storage Cheat Sheet).
 */

const crypto = require("crypto");

const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const KEYLEN = 64;

/** Política de contraseñas (HAL-12): mínimo 12 caracteres y 3 de 4 categorías. */
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEYLEN, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("hex"),
    hash.toString("hex"),
  ].join("$");
}

/**
 * Verifica una contraseña contra su hash.
 * @returns {{ ok: boolean, legacy: boolean }} `legacy` es true si el hash recibido
 * era texto plano (DB antigua) y la contraseña coincidió: hay que re-hashear.
 */
function verifyPassword(plain, stored) {
  if (typeof stored !== "string") return { ok: false, legacy: false };
  // Compatibilidad con la base antigua: contraseña en texto plano (HAL-02).
  if (!stored.startsWith("scrypt$")) {
    return { ok: stored === plain, legacy: true };
  }
  try {
    const [, nStr, rStr, pStr, saltHex, hashHex] = stored.split("$");
    const params = {
      N: Number.parseInt(nStr, 10),
      r: Number.parseInt(rStr, 10),
      p: Number.parseInt(pStr, 10),
      // Mismo límite que hashPassword: scrypt con N=32768, r=8 necesita
      // ~32 MiB y el valor por defecto de Node (32 MiB) lo rechaza con
      // ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
      maxmem: PARAMS.maxmem,
    };
    if (
      !Number.isFinite(params.N) ||
      !Number.isFinite(params.r) ||
      !Number.isFinite(params.p) ||
      !saltHex ||
      !hashHex
    ) {
      return { ok: false, legacy: false };
    }
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length, params);
    if (actual.length !== expected.length) return { ok: false, legacy: false };
    return { ok: crypto.timingSafeEqual(actual, expected), legacy: false };
  } catch {
    return { ok: false, legacy: false };
  }
}

/** Validación de política de contraseñas (HAL-12). Devuelve null si es válida. */
function validarPoliticaContrasena(password, nombreUsuario) {
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
        "La contraseña debe incluir al menos 3 de las siguientes categorías: minúsculas, mayúsculas, números y símbolos"
      );
    }
    if (nombreUsuario && password.toLowerCase().includes(nombreUsuario.toLowerCase())) {
      errores.push("La contraseña no puede contener el nombre de usuario");
    }
  }
  return errores.length > 0 ? errores : null;
}

/** Quita el valor de la contraseña de cualquier objeto antes de responder (HAL-02). */
function sinHash(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const copia = { ...obj };
  delete copia.contrasena;
  delete copia.contrasena_hash;
  delete copia.password;
  return copia;
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  hashPassword,
  verifyPassword,
  validarPoliticaContrasena,
  sinHash,
};
