const express = require("express");
const { pool } = require("../db");
const { requireAuth, normalizarRol } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditoria");

const router = express.Router();

/**
 * Roles del sistema (nombres inmutables). No pueden renombrarse, eliminarse
 * ni crearse duplicados. Corrige la cadena de escalamiento de HAL-07:
 * renombrar `admin` para liberarlo y reasignarlo a otra fila, o usar el alias
 * `administrador`, dejaba de ser explotable porque (1) las rutas exigen admin
 * y (2) los nombres de roles del sistema están protegidos.
 */
const ROLES_SISTEMA = ["admin", "medico", "paciente"];

function esRolSistema(nombre) {
  return ROLES_SISTEMA.includes(String(nombre || "").toLowerCase());
}

/** Validate básico del nombre: string, 2..50, con allowlist razonable. */
function validarNombreRol(nombre) {
  if (typeof nombre !== "string") {
    return { error: "El nombre del rol es requerido" };
  }
  const limpio = nombre.trim();
  if (limpio.length < 2 || limpio.length > 50) {
    return { error: "El nombre del rol debe tener entre 2 y 50 caracteres" };
  }
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9 _-]+$/.test(limpio)) {
    return { error: "El nombre del rol contiene caracteres no válidos" };
  }
  return { valor: limpio };
}

router.post("/", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  const { nombre } = req.body;
  try {
    const validacion = validarNombreRol(nombre);
    if (validacion.error) {
      return res.status(400).json({ error: "Error de validación", glosa: validacion.error });
    }
    if (esRolSistema(validacion.valor)) {
      return res.status(400).json({
        error: "Operación no permitida",
        glosa: "No se pueden crear roles con nombres reservados del sistema",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "INSERT INTO roles (nombre) VALUES ($1) RETURNING *",
        [validacion.valor]
      );
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "ROLES_CREAR",
          recurso: `roles/${result.rows[0].id}`,
          detalle: `creó rol ${validacion.valor}`,
        },
        client
      );
      await client.query("COMMIT");
      res.status(201).json(result.rows[0]);
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

router.get("/", requireAuth(), async (req, res, next) => {
  try {
    const result = await pool.query("SELECT id, nombre FROM roles ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    const result = await pool.query("SELECT id, nombre FROM roles WHERE id=$1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  const { nombre } = req.body;
  try {
    const validacion = validarNombreRol(nombre);
    if (validacion.error) {
      return res.status(400).json({ error: "Error de validación", glosa: validacion.error });
    }

    const actual = await pool.query("SELECT id, nombre FROM roles WHERE id=$1", [req.params.id]);
    if (actual.rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    // Protección de roles del sistema: no renombrar ni ocupar nombres reservados.
    if (esRolSistema(actual.rows[0].nombre)) {
      return res.status(400).json({
        error: "Operación no permitida",
        glosa: "Los roles del sistema no pueden renombrarse",
      });
    }
    if (esRolSistema(validacion.valor)) {
      return res.status(400).json({
        error: "Operación no permitida",
        glosa: "No se puede usar un nombre reservado del sistema",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE roles SET nombre=$1 WHERE id=$2 RETURNING *",
        [validacion.valor, req.params.id]
      );
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "ROLES_ACTUALIZAR",
          recurso: `roles/${req.params.id}`,
          detalle: `renombra a ${validacion.valor}`,
        },
        client
      );
      await client.query("COMMIT");
      res.json(result.rows[0]);
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

router.delete("/:id", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  try {
    const actual = await pool.query("SELECT id, nombre FROM roles WHERE id=$1", [req.params.id]);
    if (actual.rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    if (esRolSistema(actual.rows[0].nombre) || esRolSistema(normalizarRol(actual.rows[0].nombre))) {
      return res.status(400).json({
        error: "Operación no permitida",
        glosa: "Los roles del sistema no pueden eliminarse",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM roles WHERE id=$1", [req.params.id]);
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "ROLES_ELIMINAR",
          recurso: `roles/${req.params.id}`,
          detalle: `eliminó rol ${actual.rows[0].nombre}`,
        },
        client
      );
      await client.query("COMMIT");
      res.json({ deleted: true });
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
