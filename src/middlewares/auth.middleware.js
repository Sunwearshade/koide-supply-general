function requireSession(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Sesion requerida' });
  }

  req.session.user.role = req.session.user.role || req.session.user.rol;
  next();
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Sesion requerida' });
    }

    const role = req.session.user.role || req.session.user.rol;

    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }

    next();
  };
}

// Bloquea todas las rutas protegidas si el usuario debe cambiar su contrasena primero.
// Solo permite /me, /login, /logout y /cambiar-password.
function requirePasswordChanged(req, res, next) {
  if (!req.session.user) return next();

  const mustChange = req.session.user.debe_cambiar_password;
  if (!mustChange) return next();

  const allowedPaths = [
    '/api/usuarios/me',
    '/api/usuarios/login',
    '/api/usuarios/logout',
    '/api/usuarios/cambiar-password'
  ];

  const path = req.path === '/' ? req.baseUrl : `${req.baseUrl}${req.path}`;
  if (allowedPaths.some((p) => path.startsWith(p))) return next();

  return res.status(403).json({
    error: 'Debes cambiar tu contrasena antes de continuar',
    debe_cambiar_password: true
  });
}

module.exports = {
  requireSession,
  requireRoles,
  requirePasswordChanged
};
