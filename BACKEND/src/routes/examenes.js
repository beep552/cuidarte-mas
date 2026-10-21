const express = require("express");
const { pool } = require("../db");
const validate = require("../middleware/validate");
const delayMiddleware = require("../middleware/delay");
const { requireAuth } = require("../middleware/auth");
const { examenMedicoSchema, updateExamenMedicoSchema } = require("../validations/examenes");
const { registrarAuditoria } = require("../utils/auditoria");
const router = express.Router();

/**
 * Migrada al middleware central requireAuth (HAL-01/04/06/07: autorización
 * coherente) y a transacciones para inserción/actualización + auditoría
 * (HAL-15). HAL-29: el retardo de 5 s es un simulador activable por
 * entorno; por defecto no aplica.
 */

router.post("/", delayMiddleware(5000), requireAuth({ roles: ["medico", "admin"] }), validate(examenMedicoSchema), async (req, res, next) => {
  try {
    const {
      tipo_examen_medico_id,
      paciente_id,
      diagnosis,
      tratamiento,
      observaciones,
      notas,
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO examen_medico (
          tipo_examen_medico_id, paciente_id, diagnosis, tratamiento, observaciones, notas
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          tipo_examen_medico_id,
          paciente_id,
          diagnosis || null,
          tratamiento || null,
          observaciones || null,
          notas || null,
        ]
      );

      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "EXAMENES_CREAR",
          recurso: `examenes/${result.rows[0].id}`,
          detalle: `para paciente ${paciente_id}`,
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

router.get("/", delayMiddleware(5000), requireAuth(), async (req, res, next) => {
  try {
    let query = `
      SELECT
        em.*,
        tem.nombre AS tipo_examen_nombre,
        p.rut AS paciente_rut,
        p.primer_nombre AS paciente_primer_nombre,
        p.apellido_paterno AS paciente_apellido_paterno,
        p.apellido_materno AS paciente_apellido_materno
       FROM examen_medico em
       JOIN tipo_examen_medico tem ON tem.id = em.tipo_examen_medico_id
       JOIN pacientes p ON p.id = em.paciente_id
    `;
    const queryParams = [];

    // El paciente sólo ve exámenes de su propia ficha (authorization desde BD).
    if (req.sesion.esPaciente) {
      const pacienteResult = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [req.sesion.token.usuarioId]
      );
      if (pacienteResult.rows.length === 0) {
        return res.status(404).json({
          error: "Paciente no encontrado",
          glosa: "No se encontró información de paciente asociada a su cuenta",
        });
      }
      query += " WHERE em.paciente_id = $1";
      queryParams.push(pacienteResult.rows[0].id);
    }

    query += " ORDER BY em.created_at DESC";

    const result = await pool.query(query, queryParams);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    let query = `
      SELECT
        em.*,
        tem.nombre AS tipo_examen_nombre,
        p.rut AS paciente_rut,
        p.primer_nombre AS paciente_primer_nombre,
        p.apellido_paterno AS paciente_apellido_paterno,
        p.apellido_materno AS paciente_apellido_materno
       FROM examen_medico em
       JOIN tipo_examen_medico tem ON tem.id = em.tipo_examen_medico_id
       JOIN pacientes p ON p.id = em.paciente_id
       WHERE em.id = $1
    `;
    const queryParams = [req.params.id];

    if (req.sesion.esPaciente) {
      const pacienteResult = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [req.sesion.token.usuarioId]
      );
      if (pacienteResult.rows.length === 0) {
        return res.status(404).json({
          error: "Paciente no encontrado",
          glosa: "No se encontró información de paciente asociada a su cuenta",
        });
      }
      query += " AND em.paciente_id = $2";
      queryParams.push(pacienteResult.rows[0].id);
    }

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0)
      return res.status(404).json({
        error: "No encontrado",
        glosa: "El examen no existe o no tiene permisos para verlo",
      });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get("/paciente/:paciente_id", requireAuth(), async (req, res, next) => {
  try {
    if (req.sesion.esPaciente) {
      const pacienteResult = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [req.sesion.token.usuarioId]
      );
      if (
        pacienteResult.rows.length === 0 ||
        String(pacienteResult.rows[0].id) !== String(req.params.paciente_id)
      ) {
        return res.status(403).json({
          error: "No autorizado",
          glosa: "Solo puede ver sus propios exámenes",
        });
      }
    }

    const result = await pool.query(
      `SELECT
        em.*,
        tem.nombre AS tipo_examen_nombre,
        p.rut AS paciente_rut,
        p.primer_nombre AS paciente_primer_nombre,
        p.apellido_paterno AS paciente_apellido_paterno,
        p.apellido_materno AS paciente_apellido_materno
       FROM examen_medico em
       JOIN tipo_examen_medico tem ON tem.id = em.tipo_examen_medico_id
       JOIN pacientes p ON p.id = em.paciente_id
       WHERE em.paciente_id = $1
       ORDER BY em.created_at DESC`,
      [req.params.paciente_id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", delayMiddleware(5000), requireAuth({ roles: ["medico", "admin"] }), validate(updateExamenMedicoSchema), async (req, res, next) => {
  try {
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = [
      "tipo_examen_medico_id",
      "paciente_id",
      "diagnosis",
      "tratamiento",
      "observaciones",
      "notas",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field}=$${paramIndex++}`);
        updateValues.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: "Error de validación",
        glosa: "Debe proporcionar al menos un campo para actualizar",
      });
    }

    updateValues.push(req.params.id);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE examen_medico SET ${updateFields.join(", ")} WHERE id=$${paramIndex} RETURNING *`,
        updateValues
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No encontrado" });
      }

      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "EXAMENES_ACTUALIZAR",
          recurso: `examenes/${req.params.id}`,
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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "DELETE FROM examen_medico WHERE id=$1 RETURNING id",
        [req.params.id]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No encontrado" });
      }
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "EXAMENES_ELIMINAR",
          recurso: `examenes/${req.params.id}`,
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
