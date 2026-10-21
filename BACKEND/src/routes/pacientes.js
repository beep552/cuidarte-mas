const express = require("express");
const { pool } = require("../db");
const validate = require("../middleware/validate");
const delayMiddleware = require("../middleware/delay");
const { requireAuth } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { pacienteSchema, updatePacienteSchema } = require("../validations/pacientes");
const { normalizeRut } = require("../utils/rut");
const { registrarAuditoria } = require("../utils/auditoria");
const router = express.Router();

/**
 * Corrige en esta ruta:
 * - HAL-01: `GET /buscar/rut/:rut` ya no es público. Exige autenticación y
 *   autorización (paciente -> sólo su propia ficha; médico/admin -> fichas
 *   completas), rate limiting y auditoría de cada consulta.
 * - HAL-14: `usuario_id` ya no se acepta en POST/PUT /pacientes (mass
 *   assignment). La vinculación cuenta ↔ ficha sólo se hace mediante el
 *   endpoint administrativo `POST /pacientes/:id/vincular`, auditado.
 * - HAL-32: listado paginado con tope (limit <= 200).
 * - HAL-29: el delay ya es controlado por entorno (default 0).
 */

// Búsqueda por RUT: sensibilidad alta -> límite estricto por IP (30/min).
const limiteBusquedaRUT = rateLimit({
  ventanaMs: 60 * 1000,
  max: 30,
  clave: (req) => req.ip || "desconocido",
});

router.post("/", requireAuth({ roles: ["medico", "admin"] }), validate(pacienteSchema), async (req, res, next) => {
  try {
    const {
      rut,
      primer_nombre,
      apellido_paterno,
      apellido_materno,
      fecha_nacimiento,
      sexo,
      nacionalidad,
      estado_civil,
      email,
      telefono,
      direccion,
      contacto_emergencia_nombre,
      contacto_emergencia_telefono,
      contacto_emergencia_relacion,
      tipo_prevision,
      tiene_convenio,
      grupo_sanguineo,
      alergias,
      enfermedades_cronicas,
      discapacidades,
      observaciones_medicas_generales,
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO pacientes (
          rut, primer_nombre, apellido_paterno, apellido_materno,
          fecha_nacimiento, sexo, nacionalidad, estado_civil,
          email, telefono, direccion,
          contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_relacion,
          tipo_prevision, tiene_convenio,
          grupo_sanguineo, alergias, enfermedades_cronicas, discapacidades, observaciones_medicas_generales
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
        [
          normalizeRut(rut),
          primer_nombre,
          apellido_paterno,
          apellido_materno || null,
          fecha_nacimiento,
          sexo,
          nacionalidad || null,
          estado_civil || null,
          email,
          telefono || null,
          direccion || null,
          contacto_emergencia_nombre || null,
          contacto_emergencia_telefono || null,
          contacto_emergencia_relacion || null,
          tipo_prevision || null,
          tiene_convenio === true,
          grupo_sanguineo || null,
          alergias || null,
          enfermedades_cronicas || null,
          discapacidades || null,
          observaciones_medicas_generales || null,
        ]
      );

      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "PACIENTES_CREAR",
          recurso: `pacientes/${result.rows[0].id}`,
          detalle: `creó ficha de ${primer_nombre} ${apellido_paterno}`,
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

router.get("/", delayMiddleware(5000), requireAuth({ roles: ["medico", "admin"] }), async (req, res, next) => {
  try {
    // HAL-32: paginación con tope (default 50, máximo 200).
    const limite = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);
    const pagina = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const result = await pool.query(
      `SELECT p.*, u.nombre_usuario
       FROM pacientes p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.id DESC
       LIMIT $1 OFFSET $2`,
      [limite, (pagina - 1) * limite]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    if (req.sesion.esPaciente) {
      const propio = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [req.sesion.token.usuarioId]
      );
      if (propio.rows.length === 0) {
        return res.status(404).json({
          error: "Paciente no encontrado",
          glosa: "No se encontró información de paciente asociada a su cuenta",
        });
      }
      if (String(propio.rows[0].id) !== String(req.params.id)) {
        return res.status(403).json({ error: "No autorizado", glosa: "Solo puede ver sus propios datos" });
      }
    }

    const result = await pool.query(
      `SELECT p.*, u.nombre_usuario
       FROM pacientes p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * HAL-01: búsqueda por RUT autenticada, autorizada, con rate limit y auditoría.
 * Respuesta retest: anónimo 401 · paciente ajeno 403 · propio 200 ·
 * médico/admin 200 · ráfaga 429.
 */
router.get("/buscar/rut/:rut", limiteBusquedaRUT, requireAuth(), async (req, res, next) => {
  try {
    const normalizedRut = normalizeRut(req.params.rut);

    const fichaResult = await pool.query(
      `SELECT p.*, u.nombre_usuario
       FROM pacientes p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.rut = $1`,
      [normalizedRut]
    );

    if (fichaResult.rows.length === 0) {
      await registrarAuditoria({
        usuarioId: req.sesion.token.usuarioId,
        accion: "PACIENTES_BUSCAR_RUT",
        resultado: "FAIL",
        detalle: "ficha no encontrada",
      }).catch(() => {});
      return res.status(404).json({ error: "No encontrado" });
    }

    const ficha = fichaResult.rows[0];

    // El paciente sólo consulta su propio RUT.
    if (req.sesion.esPaciente) {
      if (Number(ficha.usuario_id) !== Number(req.sesion.token.usuarioId)) {
        return res.status(403).json({ error: "No autorizado", glosa: "Solo puede consultar su propia ficha" });
      }
    }

    await registrarAuditoria({
      usuarioId: req.sesion.token.usuarioId,
      accion: "PACIENTES_BUSCAR_RUT",
      resultado: "OK",
      recurso: `pacientes/${ficha.id}`,
    }).catch(() => {});

    res.json(ficha);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth(), validate(updatePacienteSchema), async (req, res, next) => {
  try {
    if (req.sesion.esPaciente) {
      const propio = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [req.sesion.token.usuarioId]
      );
      if (propio.rows.length === 0) {
        return res.status(404).json({
          error: "Paciente no encontrado",
          glosa: "No se encontró información de paciente asociada a su cuenta",
        });
      }
      if (String(propio.rows[0].id) !== String(req.params.id)) {
        return res.status(403).json({ error: "No autorizado", glosa: "Solo puede actualizar sus propios datos" });
      }
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    // HAL-14: `usuario_id` eliminado del allowlist; el vínculo ficha↔cuenta
    // sólo cambia con POST /pacientes/:id/vincular (con auditoría).
    const allowedFields = [
      "rut", "primer_nombre", "apellido_paterno", "apellido_materno",
      "fecha_nacimiento", "sexo", "nacionalidad", "estado_civil",
      "email", "telefono", "direccion",
      "contacto_emergencia_nombre", "contacto_emergencia_telefono", "contacto_emergencia_relacion",
      "tipo_prevision", "tiene_convenio",
      "grupo_sanguineo", "alergias", "enfermedades_cronicas", "discapacidades", "observaciones_medicas_generales",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field}=$${paramIndex++}`);
        updateValues.push(field === "rut" ? normalizeRut(req.body[field]) : req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: "Error de validación",
        glosa: "Debe proporcionar al menos un campo para actualizar",
      });
    }

    updateValues.push(req.params.id);
    const result = await pool.query(
      `UPDATE pacientes SET ${updateFields.join(", ")} WHERE id=$${paramIndex} RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    await registrarAuditoria({
      usuarioId: req.sesion.token.usuarioId,
      accion: "PACIENTES_ACTUALIZAR",
      recurso: `pacientes/${req.params.id}`,
    });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "DELETE FROM pacientes WHERE id=$1 RETURNING id",
        [req.params.id]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No encontrado" });
      }
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "PACIENTES_ELIMINAR",
          recurso: `pacientes/${req.params.id}`,
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

/**
 * HAL-14: vinculación administrativa ficha ↔ cuenta de usuario.
 * Resuelve el flujo de registro 202 (solicitud de vinculación, HAL-08):
 * un admin verifica la identidad del titular y ejecuta el enlace, que
 * queda auditado. `usuario_id` nunca lo provee el paciente.
 */
router.post("/:id/vincular", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  try {
    const { usuario_id } = req.body;
    if (!Number.isInteger(Number(usuario_id)) || Number(usuario_id) <= 0) {
      return res.status(400).json({ error: "Error de validación", glosa: "usuario_id numérico es requerido" });
    }

    const usuario = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND activo = true", [usuario_id]);
    if (usuario.rows.length === 0) {
      return res.status(400).json({ error: "Error de validación", glosa: "El usuario no existe o está inactivo" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE pacientes SET usuario_id = $1 WHERE id = $2 RETURNING id",
        [Number(usuario_id), req.params.id]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No encontrado" });
      }
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "PACIENTES_VINCULAR",
          recurso: `pacientes/${req.params.id}`,
          detalle: `vinculó usuario ${Number(usuario_id)} tras verificar identidad`,
        },
        client
      );
      await client.query("COMMIT");
      res.json({ vinculado: true, paciente_id: req.params.id, usuario_id: Number(usuario_id) });
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
