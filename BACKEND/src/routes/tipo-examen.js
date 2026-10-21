const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// OBS-02: el catálogo deja de ser público; ahora exige autenticación.
router.get("/", requireAuth(), async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre FROM tipo_examen_medico ORDER BY nombre ASC"
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth(), async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre FROM tipo_examen_medico WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "No encontrado" });

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
