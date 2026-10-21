const express = require("express");
const multer = require("multer");
const { pool } = require("../db");
const delayMiddleware = require("../middleware/delay");
const { requireAuth } = require("../middleware/auth");
const { registrarAuditoria } = require("../utils/auditoria");
const router = express.Router();

/**
 * Corrige:
 * - HAL-18: además del MIME declarado por el cliente, se validan los
 *   *magic bytes* del archivo (PDF/JPEG/PNG); los archivos cuyo contenido no
 *   corresponda con los formatos permitidos son rechazados con 400.
 * - HAL-22: `paciente_id` ya no se acepta del cliente; se deriva del
 *   examen referenciado (garantía de coherencia examen-paciente-documento).
 * - HAL-20: las comparaciones BIGINT (string) vs número usan Number() en
 *   ambos lados; con el type parser de db.js, el paciente vuelve a
 *   poder descargar sus documentos.
 * - HAL-26: los errores de multer se propagan con next(err) -> manejador
 *   global 400/413 JSON; nada se enmascara con 500.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Firmas binarias permitidas (magic bytes).
const FIRMAS = [
  { nombre: "PDF", bytes: Buffer.from("%PDF-") },
  { nombre: "JPEG", bytes: Buffer.from([0xff, 0xd8, 0xff]) },
  { nombre: "PNG", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
];

function detectarFirma(buffer) {
  if (!buffer || buffer.length < 4) return null;
  for (const firma of FIRMAS) {
    if (buffer.subarray(0, firma.bytes.length).equals(firma.bytes)) {
      return firma.nombre;
    }
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error("Solo se permiten documentos PDF, JPG o PNG");
      error.status = 400;
      error.glosa = "Solo se permiten archivos PDF, JPG o PNG";
      cb(error, false);
    }
  },
});

router.post(
  "/",
  delayMiddleware(5000),
  requireAuth({ roles: ["medico", "admin"] }),
  upload.single("documento"),
  async (req, res, next) => {
    try {
      const { examen_medico_id } = req.body;

      if (!examen_medico_id || !req.file) {
        return res.status(400).json({
          error: "Error de validación",
          glosa: "examen_medico_id y un documento son requeridos",
        });
      }

      // Validación de contenido real, no del MIME declarado (HAL-18).
      const firma = detectarFirma(req.file.buffer);
      if (!firma) {
        return res.status(400).json({
          error: "Archivo rechazado",
          glosa: "El contenido del archivo no corresponde a PDF, JPG o PNG válido",
        });
      }

      // HAL-22: el examen determina al paciente; el cliente no envía paciente_id.
      const examenResult = await pool.query(
        "SELECT id, paciente_id FROM examen_medico WHERE id = $1",
        [examen_medico_id]
      );
      if (examenResult.rows.length === 0) {
        return res.status(404).json({
          error: "Examen no encontrado",
          glosa: "El examen referenciado no existe",
        });
      }
      const pacienteDeterminado = examenResult.rows[0].paciente_id;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const result = await client.query(
          `INSERT INTO documentos_examen (
            examen_medico_id, paciente_id, documento, nombre_archivo
          ) VALUES ($1, $2, $3, $4) RETURNING id, nombre_archivo, created_at`,
          [examen_medico_id, pacienteDeterminado, req.file.buffer, req.file.originalname]
        );

        await registrarAuditoria(
          {
            usuarioId: req.sesion.token.usuarioId,
            accion: "DOCUMENTOS_CREAR",
            recurso: `documentos/${result.rows[0].id}`,
            detalle: `subió "${result.rows[0].nombre_archivo}" (${firma}) para examen ${examen_medico_id}`,
          },
          client
        );

        await client.query("COMMIT");
        res.status(201).json({ documento: result.rows[0] });
      } catch (txError) {
        await client.query("ROLLBACK").catch(() => {});
        throw txError;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  }
);

router.get("/examen/:examen_id", requireAuth(), async (req, res, next) => {
  try {
    if (req.sesion.esPaciente) {
      // Number() en ambos lados para no comparar "3" !== 3 (HAL-20).
      const examenResult = await pool.query(
        `SELECT em.paciente_id, p.usuario_id
         FROM examen_medico em
         JOIN pacientes p ON p.id = em.paciente_id
         WHERE em.id = $1`,
        [req.params.examen_id]
      );
      if (
        examenResult.rows.length === 0 ||
        Number(examenResult.rows[0].usuario_id) !== Number(req.sesion.token.usuarioId)
      ) {
        return res.status(403).json({
          error: "No autorizado",
          glosa: "Solo puede ver sus propios documentos",
        });
      }
    }

    const result = await pool.query(
      `SELECT id, nombre_archivo, created_at
       FROM documentos_examen
       WHERE examen_medico_id = $1
       ORDER BY created_at DESC`,
      [req.params.examen_id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    const docResult = await pool.query(
      `SELECT de.*, em.paciente_id, p.usuario_id
       FROM documentos_examen de
       JOIN examen_medico em ON em.id = de.examen_medico_id
       JOIN pacientes p ON p.id = em.paciente_id
       WHERE de.id = $1`,
      [req.params.id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: "No encontrado" });
    }

    const documento = docResult.rows[0];

    if (req.sesion.esPaciente) {
      // DAC correcto: decodificar ambos IDs a número (HAL-20).
      if (Number(documento.usuario_id) !== Number(req.sesion.token.usuarioId)) {
        return res.status(403).json({
          error: "No autorizado",
          glosa: "Solo puede ver sus propios documentos",
        });
      }
    }

    const extension = String(documento.nombre_archivo).split(".").pop().toLowerCase();
    let contentType = "application/pdf";
    if (["jpg", "jpeg"].includes(extension)) contentType = "image/jpeg";
    else if (extension === "png") contentType = "image/png";

    // Defensa de descarga: el archivo nunca se interpreta (HAL-18/HAL-26).
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${String(documento.nombre_archivo).replace(/"/g, "")}"`
    );
    res.send(documento.documento);
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
        "DELETE FROM documentos_examen WHERE id=$1 RETURNING id",
        [req.params.id]
      );
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "No encontrado" });
      }
      await registrarAuditoria(
        {
          usuarioId: req.sesion.token.usuarioId,
          accion: "DOCUMENTOS_ELIMINAR",
          recurso: `documentos/${req.params.id}`,
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
