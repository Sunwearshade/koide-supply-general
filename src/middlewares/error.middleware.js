function notFoundHandler(req, res, next) {
  next({
    status: 404,
    message: 'Ruta no encontrada'
  });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: err.message || 'Error interno del servidor'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
