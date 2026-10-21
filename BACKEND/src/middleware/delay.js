/**
 * Middleware de retardo simulado para pruebas.
 *
 * Corrige HAL-29: antes aplicaba incondicionalmente 5 segundos a rutas
 * críticas. Ahora el retardo es 0 por defecto y sólo se activa cuando se
 * define SIMULATE_DELAY_MS (demos/pruebas de red). En producción el valor
 * se ignora salvo que se defina explícitamente.
 */

function delayMiddleware(ms = 5000) {
  if (process.env.SIMULATE_DELAY_MS) {
    const retardado = Number.parseInt(process.env.SIMULATE_DELAY_MS, 10);
    if (Number.isFinite(retardado) && retardado > 0) {
      return (req, res, next) => {
        setTimeout(next, retardado);
      };
    }
  }
  return (req, res, next) => next();
}

module.exports = delayMiddleware;
