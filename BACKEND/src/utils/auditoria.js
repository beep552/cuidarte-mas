/**
 * Helper de auditoría.
 *
 * Corrige:
 * - HAL-17: antes se insertaba `authUser.nombreUsuario` (texto) en la columna
 *   `auditoria.usuario_id BIGINT`, lo que provocaba 500 después de operaciones
 *   destructivas. Ahora siempre se usa `usuarioId` (numérico) o NULL.
 * - HAL-16: la auditoría se escribe desde el servidor con el actor real,
 *   resultado (OK/FAIL) y, cuando se dispone de él, IP y user-agent.
 * - HAL-28 (parcial): se registran los valores previos/nuevos cuando el
 *   llamador los entrega.
 *
 * `client` es opcional: si se entrega (una conexión de pool con BEGIN activo),
 * la inserción participa de la transacción y rollback con la operación.
 */

const { pool } = require("../db");

/**
 * Registra una acción de auditoría.
 * @param {object} opciones
 * @param {number|null} opciones.usuarioId ID numérico del actor (del token).
 * @param {string} opciones.accion Acción tipada, p. ej. USUARIOS_CREAR.
 * @param {object} [opciones.extras] Campos adicionales.
 * @param {object} [opciones.extras.resultado] "OK" | "FAIL".
 * @param {object} [opciones.extras.ip] IP del solicitante (X-Forwarded-For o socket).
 * @param {object} [opciones.extras.userAgent] User-Agent.
 * @param {object} [opciones.extras.recurso] Identificador del recurso, p. ej. "usuarios/3".
 * @param {object} [opciones.extras.detalle] Texto libre adicional (sin datos sensibles).
 * @param {import("pg").PoolClient} [client] Conexión transaccional opcional.
 */
async function registrarAuditoria(
  { usuarioId = null, actorNombre = null, accion, resultado = "OK", recurso = null, detalle = null },
  client = null
) {
  const db = client || pool;
  const idNum = Number.isFinite(Number(usuarioId)) && usuarioId !== null
    ? Number(usuarioId)
    : null;

  // HAL-28: se conserva el actor mediante snapshot de nombre, además de la
  // FK, para no perder atribución si desaparece el registro de usuario.
  let nombreActor = actorNombre;
  if (!nombreActor && idNum !== null) {
    const actor = await db.query(
      "SELECT nombre_usuario FROM usuarios WHERE id = $1",
      [idNum]
    );
    nombreActor = actor.rows[0]?.nombre_usuario ?? null;
  }

  const partes = [`ACCION=${accion}`, `RESULTADO=${resultado}`];
  if (recurso) partes.push(`RECURSO=${recurso}`);
  if (detalle) partes.push(`DETALLE=${detalle}`);
  const accionText = partes.join(" | ");

  await db.query(
    `INSERT INTO auditoria (usuario_id, actor_nombre, accion)
     VALUES ($1, $2, $3)`,
    [idNum, nombreActor, accionText]
  );
}

/** Obtiene la IP real considerando el proxy de Docker/Nginx. */
function obtenerIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

/** Construye el objeto base { usuarioId, ip, userAgent } para registrarAuditoria. */
function contextoAuditoria(req, token = req.sesion?.token || {}) {
  return {
    usuarioId: token.usuarioId ?? null,
    ip: obtenerIp(req),
    userAgent: req.headers["user-agent"] || null,
  };
}

module.exports = {
  registrarAuditoria,
  obtenerIp,
  contextoAuditoria,
};
