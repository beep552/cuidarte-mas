const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool } = require("../db");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { rateLimit, claveLogin } = require("../middleware/rateLimit");
const { loginSchema, registerSchema } = require("../validations/auth");
const { normalizeRut, validarRut } = require("../utils/rut");
const {
  hashPassword,
  verifyPassword,
  validarPoliticaContrasena,
} = require("../utils/password");
const { registrarAuditoria } = require("../utils/auditoria");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

/** Emite un JWT con claims completos y versión de sesión. */
function firmarToken({ user, roles, pacienteId, tokenVersion }) {
  return jwt.sign(
    {
      usuarioId: user.id,
      nombreUsuario: user.nombre_usuario,
      rolId: roles.length > 0 ? roles[0].id : null,
      rolNombre: roles.length > 0 ? roles[0].nombre : null,
      pacienteId: pacienteId ?? null,
      roles,
      // Versión de sesión para revocación (HAL-09): sube al cambiar
      // contraseña, rol, al desactivar la cuenta o al hacer logout.
      ver: tokenVersion,
      jti: crypto.randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: "1h", algorithm: "HS256" }
  );
}

async function cargarRolesYTokenVersion(usuarioId, client = null) {
  const db = client || pool;
  const rolesResult = await db.query(
    `SELECT r.id, r.nombre
     FROM usuario_roles ur
     JOIN roles r ON r.id = ur.rol_id
     WHERE ur.usuario_id = $1`,
    [usuarioId]
  );
  const versionResult = await db.query(
    "SELECT token_version FROM usuarios WHERE id = $1",
    [usuarioId]
  );
  return {
    roles: rolesResult.rows,
    tokenVersion: versionResult.rows[0]?.token_version ?? 0,
  };
}

router.post(
  "/login",
  rateLimit({ ventanaMs: 60 * 1000, max: 5, clave: claveLogin }),
  validate(loginSchema),
  async (req, res, next) => {
    const { nombre_usuario, password } = req.body;
    try {
      const result = await pool.query(
        "SELECT id, nombre_usuario, contrasena, correo, activo, token_version FROM usuarios WHERE nombre_usuario = $1",
        [nombre_usuario]
      );

      // Mensaje genérico para no distinguir usuario inexistente de contraseña
      // incorrecta (OBS-08) y registrar intento fallido (HAL-16/19).
      const fallar = () => {
        req.registrarFallo?.();
        return res.status(401).json({ error: "Credenciales inválidas" });
      };

      const user = result.rows[0];
      if (!user || user.activo === false) return fallar();

      const verificacion = verifyPassword(password, user.contrasena);
      if (!verificacion.ok) {
        await registrarAuditoria({ usuarioId: user.id, accion: "LOGIN", resultado: "FAIL" }).catch(
          () => {}
        );
        req.registrarFallo?.();
        return fallar();
      }

      // Autorreparación (HAL-02): si la contraseña estaba en texto plano o con
      // un algoritmo antiguo, se re-hashea con el algoritmo actual.
      if (verificacion.legacy || !user.contrasena.startsWith("scrypt$")) {
        await pool.query("UPDATE usuarios SET contrasena = $1 WHERE id = $2", [
          hashPassword(password),
          user.id,
        ]);
      }

      const { roles, tokenVersion } = await cargarRolesYTokenVersion(user.id);

      const pacienteResult = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [user.id]
      );
      const pacienteId = pacienteResult.rows[0]?.id ?? null;

      const token = firmarToken({ user, roles, pacienteId, tokenVersion });

      await registrarAuditoria(
        {
          usuarioId: user.id,
          accion: "LOGIN",
          resultado: "OK",
          detalle: "usuario inició sesión",
        }
      );

      res.json({ token });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Registro.
 * Corrige HAL-08: ya NO vincula automáticamente la ficha de un paciente
 * existente. Si el RUT pertenece a una ficha sin cuenta, se crea la cuenta y
 * se registra una solicitud de vinculación que debe aprobar un administrador;
 * si el RUT tiene cuenta, se responde 409 sin revelar datos personales.
 * Corrige HAL-12/13: exige política de contraseñas y DV del RUT (módulo 11).
 * Corrige HAL-15: usuario + rol + auditoría se ejecutan en transacción.
 */
router.post(
  "/registro",
  rateLimit({ ventanaMs: 60 * 1000, max: 5, clave: (req) => req.ip || "desconocido" }),
  validate(registerSchema),
  async (req, res, next) => {
    const { nombre_usuario, password, correo, rut } = req.body;
    try {
      const errores = validarPoliticaContrasena(password, nombre_usuario);
      if (errores) {
        return res.status(400).json({
          error: "Error de validación",
          glosa: errores.join(". "),
        });
      }

      const normalizedRut = rut ? normalizeRut(rut) : null;
      if (rut) {
        const validacion = validarRut(rut);
        if (!validacion.valido) {
          return res.status(400).json({
            error: "Error de validación",
            glosa: validacion.motivo,
          });
        }
      }

      let fichaExistenteSinCuenta = null;
      if (normalizedRut) {
        const rutCheck = await pool.query(
          "SELECT id, usuario_id FROM pacientes WHERE rut = $1",
          [normalizedRut]
        );
        const ficha = rutCheck.rows[0] || null;
        if (ficha) {
          if (ficha.usuario_id) {
            return res.status(409).json({
              error: "Registro no completado",
              glosa: "Revise los datos ingresados e inténtelo de nuevo",
            });
          }
          fichaExistenteSinCuenta = ficha;
        }
      }

      const usuarioCheck = await pool.query(
        "SELECT id FROM usuarios WHERE nombre_usuario = $1 OR correo = $2",
        [nombre_usuario, correo]
      );
      if (usuarioCheck.rows.length > 0) {
        return res.status(409).json({
          error: "Registro no completado",
          glosa: "Revise los datos ingresados e inténtelo de nuevo",
        });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const userResult = await client.query(
          "INSERT INTO usuarios (nombre_usuario, contrasena, correo) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, correo, created_at",
          [nombre_usuario, hashPassword(password), correo]
        );
        const user = userResult.rows[0];

        const rolPacienteResult = await client.query(
          "SELECT id, nombre FROM roles WHERE nombre = 'paciente'"
        );
        const rolPaciente = rolPacienteResult.rows[0];
        if (!rolPaciente) {
          throw Object.assign(new Error("El rol del sistema 'paciente' no existe"), {
            glosaInterna: true,
          });
        }
        await client.query(
          "INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)",
          [user.id, rolPaciente.id]
        );

        // HAL-08: la ficha existente nunca se enlaza automáticamente. Sólo se
        // registra la solicitud para revisión administrativa y auditoría.
        if (fichaExistenteSinCuenta) {
          await registrarAuditoria(
            {
              usuarioId: user.id,
              accion: "PACIENTES_VINCULAR_SOLICITUD",
              resultado: "PEND",
              recurso: `pacientes/${fichaExistenteSinCuenta.id}`,
              detalle: "solicitud de vinculación pendiente de verificación de identidad",
            },
            client
          );
        } else if (normalizedRut) {
          await registrarAuditoria(
            {
              usuarioId: user.id,
              accion: "REGISTRO",
              detalle: `cuenta registrada con RUT propio (sin ficha)`,
            },
            client
          );
        } else {
          await registrarAuditoria(
            { usuarioId: user.id, accion: "REGISTRO", detalle: "nuevo usuario registrado" },
            client
          );
        }

        await client.query("COMMIT");

        if (fichaExistenteSinCuenta) {
          return res.status(202).json({
            message: "Cuenta creada",
            usuario: user,
            vinculacion:
              "Su RUT corresponde a una ficha existente. Un administrador la verificará y vinculará tras comprobar su identidad; hasta entonces no verá datos clínicos.",
          });
        }

        res.status(201).json({
          message: "Usuario registrado exitosamente",
          usuario: user,
        });
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

/**
 * Logout real (HAL-09): incrementa token_version, invalidando todos los
 * JWT emitidos para el usuario hasta ese momento.
 */
router.post("/logout", requireAuth(), async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE usuarios SET token_version = token_version + 1 WHERE id = $1",
      [req.sesion.token.usuarioId]
    );
    await registrarAuditoria(
      { usuarioId: req.sesion.token.usuarioId, accion: "LOGOUT", detalle: "sesión revocada" }
    );
    res.json({ message: "Sesión finalizada" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
