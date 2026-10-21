/**
 * Manejador global de errores en formato JSON.
 *
 * Corrige:
 * - HAL-26: errores de `multer` (archivo demasiado grande, campo inesperado,
 *   formato rechazado por el filtro) ahora responden 413/400 JSON coherente
 *   en lugar del HTML por defecto de Express.
 * - HAL-31: nunca se expone `err.message` interno al cliente. Se mapean los
 *   errores de PostgreSQL más comunes (23505 duplicado -> 409, 23503 FK ->
 *   400, 22P02 tipo inválido -> 400) a mensajes genéricos. El detalle completo
 *   queda sólo en el log del servidor, con un correlationId.
 */

const crypto = require("crypto");

function mapearError(err) {
  // Multer
  if (err && err.name === "MulterError") {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return { status: 413, error: "Archivo demasiado grande", glosa: "El tamaño máximo permitido es 10 MB" };
      case "LIMIT_UNEXPECTED_FILE":
        return { status: 400, error: "Archivo inesperado", glosa: "El campo de archivo no coincide con lo esperado" };
      default:
        return { status: 400, error: "Error en la carga de archivos", glosa: "No se pudo procesar el archivo enviado" };
    }
  }
  // Error del fileFilter de multer (Error común con status personalizado)
  if (err && err.status && !err.code) {
    return { status: err.status, error: "Solicitud inválida", glosa: err.glosa || "Solicitud no válida" };
  }

  // PostgreSQL
  if (err && typeof err.code === "string" && err.code.length === 5) {
    switch (err.code) {
      case "23505":
        return { status: 409, error: "Registro duplicado", glosa: "El dato ya está registrado" };
      case "23503":
        return { status: 400, error: "Referencia inválida", glosa: "El elemento relacionado no existe" };
      case "23514":
        return { status: 400, error: "Dato inválido", glosa: "El valor no cumple las restricciones del sistema" };
      case "22P02":
        return { status: 400, error: "Identificador inválido", glosa: "El formato del identificador no es válido" };
      case "42501":
        return { status: 403, error: "Permiso denegado", glosa: "No tiene permisos para esta operación" };
      default:
        break;
    }
  }
  return {
    status: 500,
    error: "Error interno del servidor",
    glosa: "Ocurrió un error inesperado. Reintente más tarde.",
  };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapeo = mapearError(err);
  const correlationId = crypto.randomUUID();

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      correlationId,
      nivel: mapeo.status >= 500 ? "error" : "warn",
      metodo: req.method,
      ruta: req.originalUrl,
      status: mapeo.status,
      mensajeInterno: err?.message,
      codigo: err?.code,
      pila: mapeo.status >= 500 ? err?.stack : undefined,
    })
  );

  res.status(mapeo.status).json({
    error: mapeo.error,
    glosa: mapeo.glosa,
    correlationId,
  });
}

module.exports = errorHandler;
