/**
 * Rate limiting en memoria, sin dependencias externas.
 *
 * Corrige HAL-19 (login sin límite de intentos) y OBS-09 (registro masivo).
 * Diseño: buckets por clave (IP o IP+usuario) con ventana deslizante simple.
 * Incluye retardo progresivo y bloqueo tras el umbral de intentos fallidos.
 */

const buckets = new Map(); // clave -> { intentos: [{t}], bloqueadoHasta }

function limpiarVencidos(bucket, ventanaMs, ahora) {
  while (bucket.intentos.length > 0 && ahora - bucket.intentos[0] > ventanaMs) {
    bucket.intentos.shift();
  }
}

/** Limpieza periódica para no retener memoria indefinidamente. */
function limpiarGlobal() {
  const ahora = Date.now();
  for (const [clave, bucket] of buckets) {
    if (
      bucket.intentos.length === 0 &&
      (!bucket.bloqueadoHasta || bucket.bloqueadoHasta < ahora)
    ) {
      buckets.delete(clave);
    }
  }
}
setInterval(limpiarGlobal, 15 * 60 * 1000).unref?.();

/**
 * Middleware de rate limiting.
 * @param {object} opciones
 * @param {number} opciones.ventanaMs Ventana en ms (default 60s).
 * @param {number} opciones.max Máximo de peticiones por ventana.
 * @param {number} opciones.maxBloqueoMs Bloqueo total al superar max (default 15 min).
 * @param {(req) => string} [opciones.clave] Generador de clave; por defecto IP.
 * @param {boolean} [opciones.cuentaFallas] Si true, sólo cuenta peticiones que
 *        el handler marque con `req.procesarIntentoFallido = true` (p. ej. login).
 */
function rateLimit({
  ventanaMs = 60 * 1000,
  max = 5,
  maxBloqueoMs = 15 * 60 * 1000,
  clave = (req) => req.ip || "desconocido",
  cuentaFallas = false,
} = {}) {
  return (req, res, next) => {
    const ahora = Date.now();
    const key = clave(req);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { intentos: [], bloqueadoHasta: 0 };
      buckets.set(key, bucket);
    }

    if (!cuentaFallas) {
      limpiarVencidos(bucket, ventanaMs, ahora);
      if (bucket.intentos.length >= max) {
        bucket.bloqueadoHasta = ahora + maxBloqueoMs;
      }
      if (bucket.bloqueadoHasta > ahora) {
        res.setHeader("Retry-After", Math.ceil((bucket.bloqueadoHasta - ahora) / 1000));
        return res.status(429).json({
          error: "Demasiadas solicitudes",
          glosa: "Espere unos minutos antes de volver a intentar",
        });
      }
      bucket.intentos.push(ahora);
      req.marcarIntentoFallido = () => {
        // Cuenta adicional: refuerza el bloqueo ante fallas internas.
        bucket.intentos.push(Date.now());
      };
      return next();
    }

    // Modo cuentaFallas: los éxitos se ignoran, los fallidos cuentan.
    limpiarVencidos(bucket, ventanaMs, ahora);
    if (bucket.intentos.length >= max) {
      bucket.bloqueadoHasta = Math.max(ahora + maxBloqueoMs, bucket.intentos.length >= max * 2 ? ahora + maxBloqueoMs * 2 : ahora + maxBloqueoMs);
    }
    if (bucket.bloqueadoHasta > ahora) {
      res.setHeader("Retry-After", Math.ceil((bucket.bloqueadoHasta - ahora) / 1000));
      return res.status(429).json({
        error: "Cuenta temporalmente bloqueada",
        glosa: "Demasiados intentos fallidos. Espere unos minutos.",
      });
    }
    req.cuentaFallas = { bucket, ventanaMs, max, maxBloqueoMs };
    req.registrarFallo = () => {
      limpiarVencidos(bucket, ventanaMs, Date.now());
      bucket.intentos.push(Date.now());
      if (bucket.intentos.length >= max) {
        bucket.bloqueadoHasta = Date.now() + maxBloqueoMs;
      }
    };
    return next();
  };
}

/** Clave estándar: IP + nombre de usuario (para login). */
function claveLogin(req) {
  return `${req.ip || "desconocido"}:${String(req.body?.nombre_usuario || "").toLowerCase()}`;
}

module.exports = { rateLimit, claveLogin };
