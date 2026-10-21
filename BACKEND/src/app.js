const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");

const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const pacientesRoutes = require("./routes/pacientes");
const examenesRoutes = require("./routes/examenes");
const documentosRoutes = require("./routes/documentos");
const tipoExamenRoutes = require("./routes/tipo-examen");
const auditRoutes = require("./routes/audit");
const rolesRoutes = require("./routes/roles");

/**
 * Corrige:
 * - HAL-03 (falla cerrada): si JWT_SECRET no existe o es débil el proceso
 *   se aborta; ya no hay fallback "inseguro" ni secreto por defecto.
 * - HAL-10: CORS con allowlist de orígenes (FRONTEND_URL), métodos y
 *   cabeceras; ya no refleja cualquier origen.
 * - HAL-11 (parcial): cabeceras de seguridad (nosniff, frame-ancestors
 *   'none', Referrer-Policy, Permissions-Policy). Las cabeceras sobre TLS
 *   (HSTS) sólo producen efecto con HTTPS; su activación es operativa.
 * - HAL-30: /docs y /openapi.json sólo se montan fuera de producción.
 * - OBS-03: se elimina el static público de /files/documentos.
 * - HAL-26/31: manejador global de errores JSON al final de la pila.
 */

const app = express();
const esProduccion = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET no está definida. El backend no firma tokens sin secreto configurado (hal-cerrado por seguridad)."
  );
}
if (String(process.env.JWT_SECRET).length < 32) {
  throw new Error(
    "JWT_SECRET es demasiado corta: configure al menos 32 caracteres aleatorios (p. ej. `openssl rand -hex 32`)."
  );
}
if (["inseguro", "your-secret-key-change-in-production"].includes(String(process.env.JWT_SECRET))) {
  throw new Error("JWT_SECRET tiene un valor por defecto inseguro: defina un secreto propio.");
}

const origenesPermitidos = [
  process.env.FRONTEND_URL,
  "http://localhost:3333",
  "http://localhost:5173",
  "http://localhost:8080",
].filter(Boolean);

app.use(
  cors({
    origin(origen, callback) {
      // Permitir peticiones sin Origin (curl, salud, Docker interno).
      if (!origen) return callback(null, true);
      if (origenesPermitidos.includes(origen)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (esProduccion && process.env.ENABLE_HSTS === "1") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(morgan(esProduccion ? "combined" : "dev"));
app.set("trust proxy", 1);

const uploadsDir = path.join(__dirname, "..", "uploads", "documentos");
fs.mkdirSync(uploadsDir, { recursive: true });

app.use("/autenticacion", authRoutes);
app.use("/usuarios", userRoutes);
app.use("/pacientes", pacientesRoutes);
app.use("/examenes", examenesRoutes);
app.use("/documentos", documentosRoutes);
app.use("/tipo-examen", tipoExamenRoutes);
app.use("/auditoria", auditRoutes);
app.use("/roles", rolesRoutes);

// HAL-30: la documentación interactiva no se publica en producción.
if (!esProduccion) {
  const openapi = require("./openapi.json");
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.get("/openapi.json", (req, res) => {
    res.json(openapi);
  });
}

app.get("/", (req, res) => {
  res.json({ name: "cuidarteplus", status: "ok" });
});

// Convierte cualquier error no controlado (pg, multer, app) en respuesta JSON
// 400/404/409/413 uniforme, sin detalles internos (HAL-26/HAL-31).
app.use(errorHandler);

// Arranque directo (`node src/app.js`); en pruebas/seeds se importa la app.
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`cuidarteplus API escuchando en puerto ${PORT}`);
  });
}

module.exports = app;
