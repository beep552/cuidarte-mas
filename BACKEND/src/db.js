const { Pool, types } = require("pg");
require("dotenv").config();

/**
 * Corrige:
 * - HAL-20: `pg` devuelve BIGINT como string; sin un type parser las
 *   comparaciones `"3" !== 3` rompían la autorización de documentos del
 *   paciente. Se convierte BIGINT (OID 20) a Number.
 *   (Los IDs caben en Number, son identity con valores pequeños.)
 * - HAL-03 (parcial): se elimina la contraseña por defecto publicada en el
 *   código. Cada entorno DEBE definir DATABASE_URL; si falta, el arranque
 *   falla cerrado en lugar de conectarse con credenciales conocidas.
 */

types.setTypeParser(20, (valor) => Number(valor)); // bigint -> number

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL no está definida. Configure el entorno (vea .env.example); el backend no se inicia sin credenciales de base de datos."
  );
}

const esProduccion = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // TLS a la base cuando el entorno lo exige (HAL-27, parcial).
  ssl: process.env.PG_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});

module.exports = { pool };
