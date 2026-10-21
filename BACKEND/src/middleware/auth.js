/**
 * Middleware centralizado de autenticación y autorización.
 *
 * Corrige:
 * - HAL-01/04/05/06/07: cada ruta registra su propia lógica inconsistente
 *   (algunas no autenticaban). Ahora hay un único middleware `requireAuth`
 *   que: (1) valida el JWT, (2) verifica el usuario en BD, (3) comprueba la
 *   versión de sesión (revocación), (4) comprueba roles contra BD.
 * - HAL-07/35: los roles del sistema se conocen por nombre normalizado e
 *   inmutable ("admin", "medico", "paciente"); el alias "administrador"
 *   se normaliza a "admin" en un solo lugar.
 * - HAL-09: cada token lleva `ver` (token_version de la BD). El middleware
 *   lo compara con la BD: si el usuario cambió rol/contraseña o hizo
 *   logout, los tokens antiguos quedan invalidados.
 */

const jwt = require("jsonwebtoken");
const { pool } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

/** Normaliza el nombre de un rol a su código inmutable del sistema. */
function normalizarRol(nombre) {
  switch (nombre) {
    case "admin":
    case "administrador":
      return "admin";
    case "medico":
      return "medico";
    case "paciente":
      return "paciente";
    default:
      return null;
  }
}

/** ¿Tiene el usuario (por BD) alguno de los roles pedidos? Acepta alias. */
function tieneRol(rolesBD, rolesPedidos) {
  const normalizados = new Set(
    (rolesBD || []).map(normalizarRol).filter(Boolean)
  );
  return (rolesPedidos || []).some((rol) => normalizados.has(rol));
}

/** ¿Es administrador según los roles de BD? */
function esAdmin(rolesBD) {
  return tieneRol(rolesBD, ["admin"]);
}

function verificarToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.substring(7), JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

/**
 * Carga la sesión completa desde BD: estado del usuario, roles actuales
 * y comparación de `token_version` con el claim `ver` del token.
 */
async function cargarSesion(req) {
  const token = verificarToken(req);
  if (!token || !Number.isFinite(Number(token.usuarioId))) return null;

  const result = await pool.query(
    `SELECT u.token_version, u.activo,
            ARRAY_REMOVE(ARRAY_AGG(r.nombre), NULL) AS roles
     FROM usuarios u
     LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
     LEFT JOIN roles r ON r.id = ur.rol_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [Number(token.usuarioId)]
  );

  const fila = result.rows[0];
  if (!fila) return null;

  return {
    token,
    activo: fila.activo !== false,
    roles: fila.roles || [],
    versionOk: Number(fila.token_version) === Number(token.ver ?? 0),
  };
}

/**
 * Middleware: exige autenticación y (opcionalmente) roles.
 * Uso: requireAuth() · requireAuth({ roles: ["admin"] }) ·
 *      requireAuth({ roles: ["medico", "admin"] })
 *
 * Deja en `req.sesion` { token, roles, isAdmin, esPaciente, esMedicoOAdmin }.
 */
function requireAuth({ roles: rolesPedidos = [] } = {}) {
  return async (req, res, next) => {
    try {
      const sesion = await cargarSesion(req);
      if (!sesion || !sesion.activo || !sesion.versionOk) {
        return res.status(401).json({ error: "No autorizado", glosa: "Sesión inválida o expirada" });
      }

      req.sesion = {
        token: sesion.token,
        roles: sesion.roles,
        isAdmin: esAdmin(sesion.roles),
        esMedicoOAdmin: tieneRol(sesion.roles, ["medico", "admin"]),
        esPaciente: tieneRol(sesion.roles, ["paciente"]) && !esAdmin(sesion.roles),
      };

      if (rolesPedidos.length > 0 && !tieneRol(sesion.roles, rolesPedidos)) {
        return res.status(403).json({
          error: "No autorizado",
          glosa: "No tiene permisos para realizar esta acción",
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireAuth,
  cargarSesion,
  verificarToken,
  tieneRol,
  esAdmin,
  normalizarRol,
};
