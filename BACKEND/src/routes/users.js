const express = require("express");
const { pool } = require("../db");
const validate = require("../middleware/validate");
const { createUserSchema, updateUserSchema } = require("../validations/users");
const { requireAuth, normalizarRol } = require("../middleware/auth");
const {
  hashPassword,
  validarPoliticaContrasena,
} = require("../utils/password");
const { registrarAuditoria } = require("../utils/auditoria");

const router = express.Router();

/**
 * Valida que el rol exista en BD. Devuelve la fila del rol o null.
 * Los IDs de roles del sistema NO se asumen por número: se resuelve por
 * nombre normalizado e inmutable (HAL-07).
 */
async function obtenerRolPorId(rolId) {
  const result = await pool.query("SELECT id, nombre FROM roles WHERE id = $1", [rolId]);
  return result.rows[0] || null;
}

/**
 * POST /usuarios — crea un usuario.
 * Corrige HAL-04: exige rol admin; el cliente puede proponer rol_id pero se
 * valida contra la BD y la asignación la hace un administrador autenticado.
 * Corrige HAL-02: la contraseña se hashea aquí (el campo `contrasena_hash`
 * del DTO se trata como contraseña en claro; el nombre se mantiene por
 * compatibilidad con el formulario).
 * Corrige HAL-15: usuario + rol + auditoría en transacción.
 */
router.post("/", requireAuth({ roles: ["admin"] }), validate(createUserSchema), async (req, res, next) => {
  const { nombre_usuario, contrasena_hash: password, correo, rol_id } = req.body;
  try {
    const errores = validarPoliticaContrasena(password, nombre_usuario);
    if (errores) {
      return res.status(400).json({
        error: "Error de validación",
        glosa: errores.join(". "),
      });
    }

    let rol = null;
    if (rol_id !== undefined && rol_id !== null) {
      rol = await obtenerRolPorId(rol_id);
      if (!rol) {
        return res.status(400).json({
          error: "Error de validación",
          glosa: "El rol indicado no existe",
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Reservar el nombre de usuario y el correo con INSERT protegido.
      const result = await client.query(
        "INSERT INTO usuarios (nombre_usuario, contrasena, correo) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, correo, created_at",
        [nombre_usuario, hashPassword(password), correo]
      );
      const newUser = result.rows[0];

      if (rol) {
        await client.query(
          "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)",
          [newUser.id, rol.id]
        );
      }

      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "USUARIOS_CREAR",
          recurso: `usuarios/${newUser.id}`,
          detalle: `creó usuario ${nombre_usuario}${rol ? ` con rol ${rol.nombre}` : " sin rol"}`,
        },
        client
      );

      await client.query("COMMIT");

      res.status(201).json(rol ? { ...newUser, rol_id: rol.id, rol_nombre: rol.nombre } : newUser);
    } catch (txError) {
      await client.query("ROLLBACK").catch(() => {});
      throw txError;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /usuarios — lista usuarios con rol (HAL-34).
 * Requiere admin (HAL-04/06), acepta paginación (HAL-32).
 */
router.get("/", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  try {
    const limite = Math.min(Number.parseInt(req.query.limit, 10) || 100, 200);
    const pagina = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const result = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.correo, u.created_at, u.activo,
              COALESCE(r.nombre, NULL) AS rol_nombre
       FROM usuarios u
       LEFT JOIN LATERAL (
         SELECT r2.nombre FROM usuario_roles ur2
         JOIN roles r2 ON r2.id = ur2.rol_id
         WHERE ur2.usuario_id = u.id
         ORDER BY r2.id LIMIT 1
       ) r ON TRUE
       ORDER BY u.id DESC
       LIMIT $1 OFFSET $2`,
      [limite, (pagina - 1) * limite]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /usuarios/:id — detalle. El paciente sólo puede ver sus propios datos.
 */
router.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    const propio =
      Number(req.sesion.token.usuarioId) === Number(req.params.id);
    if (req.sesion.esPaciente && !propio) {
      return res.status(403).json({ error: "No autorizado", glosa: "Solo puede ver sus propios datos" });
    }

    const result = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.correo, u.created_at, u.activo,
              ur.rol_id, r.nombre AS rol_nombre
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       WHERE u.id = $1
       LIMIT 1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ ...result.rows[0], es_unico_administrador: false });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /usuarios/:id — actualización.
 * Corrige HAL-05: sólo un ADMIN cambia roles; NADIE cambia su propio rol
 * (ni siquiera admin); el rol destino debe existir y no puede dejar al
 * sistema sin administradores (protege el último admin).
 * Corrige HAL-02: la contraseña nueva se hashea con scrypt.
 * Corrige HAL-21: validate reasigna el body filtrado y updateUserSchema
 * declara rol_id explícitamente.
 * Corrige HAL-15: operaciones en transacción + auditoría.
 * Corrige HAL-09: sube token_version tras cambiar contraseña o rol.
 */
router.put("/:id", requireAuth(), validate(updateUserSchema), async (req, res, next) => {
  const { nombre_usuario, contrasena_hash: password, correo, rol_id } = req.body;
  const actorId = Number(req.sesion.token.usuarioId);
  const objetivoId = Number(req.params.id);

  try {
    const objetivo = await pool.query(
      "SELECT id, nombre_usuario, contrasena, activo FROM usuarios WHERE id = $1",
      [objetivoId]
    );
    if (objetivo.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }

    const esPropio = actorId === objetivoId;
    const cambioRol = rol_id !== undefined && rol_id !== null;

    // Regla de autorización única (HAL-05): admin para datos ajenos y roles.
    // Un paciente/médico sólo puede editar su propio perfil básico.
    if (!esPropio && !req.sesion.isAdmin) {
      return res.status(403).json({
        error: "No autorizado",
        glosa: "Solo los administradores pueden editar otros usuarios",
      });
    }

    if (cambioRol) {
      if (!req.sesion.isAdmin) {
        return res.status(403).json({
          error: "No autorizado",
          glosa: "Solo un administrador puede cambiar roles",
        });
      }
      if (esPropio) {
        return res.status(403).json({
          error: "No autorizado",
          glosa: "Nadie puede cambiar su propio rol",
        });
      }

      const rol = await obtenerRolPorId(rol_id);
      if (!rol) {
        return res.status(400).json({ error: "Error de validación", glosa: "El rol indicado no existe" });
      }

      // Protección del último administrador (HAL-33).
      if (normalizarRol(rol.nombre) !== "admin") {
        const objetivoRoles = await pool.query(
          `SELECT r.nombre FROM usuario_roles ur
           JOIN roles r ON r.id = ur.rol_id
           WHERE ur.usuario_id = $1`,
          [objetivoId]
        );
        const rolesObjetivoBD = objetivoRoles.rows.map(normalizarRol).filter(Boolean);
        if (rolesObjetivoBD.includes("admin")) {
          const admins = await pool.query(
            `SELECT COUNT(DISTINCT ur.usuario_id) AS total
             FROM usuario_roles ur JOIN roles r ON r.id = ur.rol_id
             WHERE r.nombre IN ('admin','administrador') AND ur.usuario_id <> $1`,
            [objetivoId]
          );
          if (Number(admins.rows[0].total) === 0) {
            return res.status(400).json({
              error: "Operación no permitida",
              glosa: "No se puede degradar al último administrador del sistema",
            });
          }
        }
      }
    }

    if (password !== undefined) {
      const errores = validarPoliticaContrasena(password, nombre_usuario);
      if (errores) {
        return res.status(400).json({ error: "Error de validación", glosa: errores.join(". ") });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (nombre_usuario !== undefined) {
        updateFields.push(`nombre_usuario=$${paramIndex++}`);
        updateValues.push(nombre_usuario);
      }
      if (password !== undefined) {
        // Re-hasheo con scrypt en toda actualización de contraseña (HAL-02):
        // se guarda el hash, nunca el texto plano.
        updateFields.push(`contrasena=$${paramIndex++}`);
        updateValues.push(hashPassword(password));
      }
      if (correo !== undefined) {
        updateFields.push(`correo=$${paramIndex++}`);
        updateValues.push(correo);
      }

      if (password !== undefined || cambioRol) {
        // HAL-09: revoca sesiones emitidas con la configuración anterior.
        updateFields.push(`token_version = token_version + 1`);
      }

      if (updateFields.length > 0) {
        updateValues.push(objetivoId);
        const result = await client.query(
          `UPDATE usuarios SET ${updateFields.join(", ")} WHERE id=$${paramIndex} RETURNING id, nombre_usuario, correo, created_at, activo`,
          updateValues
        );
        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "No encontrado" });
        }
      }

      if (cambioRol) {
        await client.query("DELETE FROM usuario_roles WHERE usuario_id = $1", [objetivoId]);
        await client.query("INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)", [
          objetivoId,
          rol_id,
        ]);
      }

      await registrarAuditoria(
        {
          usuarioId: actorId,
          accion: "USUARIOS_ACTUALIZAR",
          recurso: `usuarios/${objetivoId}`,
          detalle: cambioRol ? `actualizó usuario y rol (rol_id=${rol_id})` : "actualizó usuario",
        },
        client
      );

      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK").catch(() => {});
      throw txError;
    } finally {
      client.release();
    }

    const usuarioResult = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.correo, u.created_at, u.activo,
              ur.rol_id, r.nombre AS rol_nombre
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN roles r ON r.id = ur.rol_id
       WHERE u.id = $1
       LIMIT 1`,
      [objetivoId]
    );

    res.json(usuarioResult.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /usuarios/:id — borrado LÓGICO (desactivación).
 * Corrige HAL-06: exige autenticación y rol admin ANTES de efectuar cualquier
 * cambio; la operación es reversible (activo=false), no física.
 * Corrige HAL-33: prohibido eliminarse a sí mismo y eliminar al último admin.
 * Corrige HAL-17: la auditoría usa usuarioId numérico y va en transacción
 * (rollback si la auditoría falla).
 */
router.delete("/:id", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  const actorId = Number(req.sesion.token.usuarioId);
  const objetivoId = Number(req.params.id);

  try {
    if (actorId === objetivoId) {
      return res.status(400).json({
        error: "Operación no permitida",
        glosa: "No puede eliminar su propia cuenta",
      });
    }

    const objetivo = await pool.query(
      `SELECT u.id, u.activo,
              EXISTS (
                SELECT 1 FROM usuario_roles ur
                JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id = u.id AND r.nombre IN ('admin','administrador')
              ) AS es_admin
       FROM usuarios u WHERE u.id = $1`,
      [objetivoId]
    );
    const fila = objetivo.rows[0];
    if (!fila) return res.status(404).json({ error: "No encontrado" });

    if (fila.es_admin) {
      const admins = await pool.query(
        `SELECT COUNT(DISTINCT ur.usuario_id) AS total FROM usuario_roles ur
         JOIN roles r ON r.id = ur.rol_id
         WHERE r.nombre IN ('admin','administrador') AND ur.usuario_id <> $1`,
        [objetivoId]
      );
      if (Number(admins.rows[0].total) === 0) {
        return res.status(400).json({
          error: "Operación no permitida",
          glosa: "No se puede eliminar al último administrador del sistema",
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Borrado lógico + revocación de sesiones activas (HAL-09).
      const result = await client.query(
        "UPDATE usuarios SET activo = false, token_version = token_version + 1 WHERE id = $1 AND activo = true RETURNING id",
        [objetivoId]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No encontrado" });
      }

      await registrarAuditoria(
        {
          usuarioId: actorId,
          accion: "USUARIOS_ELIMINAR",
          resultado: "OK",
          recurso: `usuarios/${objetivoId}`,
          detalle: "desactivó usuario (borrado lógico)",
        },
        client
      );

      await client.query("COMMIT");
      res.json({ deleted: true, borradoLogico: true });
    } catch (txError) {
      await client.query("ROLLBACK").catch(() => {});
      throw txError;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
