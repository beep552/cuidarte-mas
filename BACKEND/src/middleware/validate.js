/**
 * Middleware de validación con yup.
 *
 * Corrige HAL-21: el middleware anterior validaba una copia (`schema.validate`)
 * con `stripUnknown: true`, pero seguía pasando al handler el `req.body`
 * original con campos desconocidos. Ahora reasigna el objeto validado
 * (allowlist estricta) en `req[source]`.
 */

const validate = (schema, source = "body") => {
  return async (req, res, next) => {
    try {
      const data = req[source];
      const validado = await schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (validado !== undefined) {
        req[source] = validado;
      }
      next();
    } catch (error) {
      if (error.name === "ValidationError") {
        const errors = error.inner.map((err) => ({
          field: err.path,
          message: err.message,
        }));
        return res.status(400).json({
          error: "Error de validación",
          glosa: "Los datos proporcionados no son válidos",
          detalles: errors,
        });
      }
      return next(error);
    }
  };
};

module.exports = validate;
