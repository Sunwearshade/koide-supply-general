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

module.exports = {
  requireSession,
  requireRoles
};
