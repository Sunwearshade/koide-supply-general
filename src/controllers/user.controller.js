const userService = require('../services/user.service');
const { createSystemMessage } = require('../services/system-message.service');

async function listUsers(req, res) {
  const users = await userService.listUsers();
  res.json(users);
}

async function createUser(req, res) {
  const user = await userService.createUser(req.body, req.session.user || null);
  if (req.session.user) {
    await createSystemMessage({
      type: 'usuario_creado',
      message: `${req.session.user.nombre} creo el usuario ${user.nombre} (${user.rol})`,
      userId: req.session.user.id_usuario
    });
  }
  res.status(201).json(user);
}

async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.body, req.session.user);
  await createSystemMessage({
    type: 'usuario_editado',
    message: `${req.session.user.nombre} edito el usuario ${user.nombre} (${user.rol})`,
    userId: req.session.user.id_usuario
  });
  res.json(user);
}

async function deactivateUser(req, res) {
  const result = await userService.deactivateUser(req.params.id, req.session.user);
  await createSystemMessage({
    type: 'usuario_desactivado',
    message: `${req.session.user.nombre} desactivo el usuario ${result.user.nombre} (${result.user.rol})`,
    userId: req.session.user.id_usuario
  });
  res.json(result);
}

async function activateUser(req, res) {
  const result = await userService.activateUser(req.params.id, req.session.user);
  await createSystemMessage({
    type: 'usuario_activado',
    message: `${req.session.user.nombre} activo el usuario ${result.user.nombre} (${result.user.rol})`,
    userId: req.session.user.id_usuario
  });
  res.json(result);
}

async function login(req, res) {
  const user = await userService.login(req.body);
  req.session.user = user;
  res.json({ user });
}

async function cambiarPassword(req, res) {
  const idUsuario = req.session.user.id_usuario;
  await userService.cambiarPassword(idUsuario, req.body);
  // Limpiar el flag en la sesion activa
  req.session.user.debe_cambiar_password = false;
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({ user: req.session.user || null });
}

async function logout(req, res) {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  login,
  me,
  logout,
  cambiarPassword
};
