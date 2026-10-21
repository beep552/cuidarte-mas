const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * Corrige:
 * - HAL-16: `POST /auditoria` desaparece de la API pública. La escritura de
 *   auditoría ocurre internamente en cada caso de uso (utils/auditoria.js),
 *   con acción tipada y actor real; los intentos se ejecutan desde el
 *   servidor, y cualquier `POST /auditoria` externo recibe 404.
 * - HAL-35: el GET exige admin y acepta el nombre normalizado
 *   ("admin" o "administrador") vía middleware central.
 * - HAL-32: paginación activa (limit default 50, máximo 200).
 */

router.post("/", (req, res) => {
  res.status(404).json({ error: "No disponible", glosa: "La auditoría no acepta escrituras externas" });
});

router.get("/", requireAuth({ roles: ["admin"] }), async (req, res, next) => {
  try {
    const limite = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);
    const pagina = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const result = await pool.query(
      `SELECT a.*, u.nombre_usuario
       FROM auditoria a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ORDER BY a.id DESC
       LIMIT $1 OFFSET $2`,
      [limite, (pagina - 1) * limite]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
