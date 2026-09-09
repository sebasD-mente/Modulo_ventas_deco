export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err.errors) {
        const details = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({
          success: false,
          error: 'Datos de entrada inválidos.',
          details,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Error de validación en la solicitud.',
      });
    }
  };
}
