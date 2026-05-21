const bcrypt = require('bcryptjs');
const pool = require('../db/mysql');

const ROLES = {
  GENERAL_ADMIN: 'admin',
  WAREHOUSE_ADMIN: 'encargado',
  WAREHOUSE_OPERATOR: 'operador'
};

function publicUser(user) {
  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    username: user.username,
    rol: user.rol,
    role: user.rol,
    activo: user.activo,
    debe_cambiar_password: Number(user.debe_cambiar_password) === 1
  };
}

async function countUsers() {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM usuarios');
  return rows[0].total;
}

function validateCreatePermission(actor, role, existingUsers) {
  if (existingUsers === 0) {
    if (role !== ROLES.GENERAL_ADMIN) {
      const error = new Error('El primer usuario debe ser administrador general');
      error.status = 400;
      throw error;
    }

    return;
  }

  if (!actor) {
    const error = new Error('Sesion requerida');
    error.status = 401;
    throw error;
  }

  if (actor.role === ROLES.GENERAL_ADMIN) {
    return;
  }

  if (actor.role === ROLES.WAREHOUSE_ADMIN && role === ROLES.WAREHOUSE_OPERATOR) {
    return;
  }

  const error = new Error('Permiso insuficiente para crear este usuario');
  error.status = 403;
  throw error;
}

function validateManagePermission(actor, targetRole) {
  if (!actor) {
    const error = new Error('Sesion requerida');
    error.status = 401;
    throw error;
  }

  const actorRole = actor.role || actor.rol;
  if (actorRole === ROLES.GENERAL_ADMIN) return;
  if (actorRole === ROLES.WAREHOUSE_ADMIN && targetRole === ROLES.WAREHOUSE_OPERATOR) return;

  const error = new Error('Permiso insuficiente para administrar este usuario');
  error.status = 403;
  throw error;
}

async function listUsers() {
  const [rows] = await pool.execute(
    `SELECT id_usuario, nombre, username, rol, activo, created_at
     FROM usuarios
     ORDER BY nombre ASC`
  );

  return rows.map(publicUser);
}

async function getUserById(idUsuario) {
  const [rows] = await pool.execute(
    `SELECT id_usuario, nombre, username, rol, activo
     FROM usuarios
     WHERE id_usuario = :idUsuario
     LIMIT 1`,
    { idUsuario }
  );

  if (!rows[0]) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function createUser({ nombre, username, password, rol }, actor = null) {
  if (!nombre || !username || !password || !rol) {
    const error = new Error('nombre, username, password y rol son requeridos');
    error.status = 400;
    throw error;
  }

  if (!Object.values(ROLES).includes(rol)) {
    const error = new Error('rol invalido');
    error.status = 400;
    throw error;
  }

  const existingUsers = await countUsers();
  validateCreatePermission(actor, rol, existingUsers);

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    `INSERT INTO usuarios (nombre, username, password_hash, rol, debe_cambiar_password)
     VALUES (:nombre, :username, :passwordHash, :rol, 1)`,
    { nombre, username, passwordHash, rol }
  );

  return publicUser({
    id_usuario: result.insertId,
    nombre,
    username,
    rol,
    activo: 1,
    debe_cambiar_password: 1
  });
}

async function updateUser(idUsuario, { nombre, username, password, rol }, actor) {
  const current = await getUserById(idUsuario);
  validateManagePermission(actor, current.rol);

  if (rol && !Object.values(ROLES).includes(rol)) {
    const error = new Error('rol invalido');
    error.status = 400;
    throw error;
  }

  if (rol) {
    validateManagePermission(actor, rol);
  }

  const fields = [];
  const params = { idUsuario };

  if (nombre !== undefined) {
    fields.push('nombre = :nombre');
    params.nombre = nombre;
  }

  if (username !== undefined) {
    fields.push('username = :username');
    params.username = username;
  }

  if (rol !== undefined) {
    fields.push('rol = :rol');
    params.rol = rol;
  }

  if (password) {
    fields.push('password_hash = :passwordHash');
    params.passwordHash = await bcrypt.hash(password, 10);
  }

  if (fields.length === 0) {
    return publicUser(current);
  }

  await pool.execute(
    `UPDATE usuarios
     SET ${fields.join(', ')}
     WHERE id_usuario = :idUsuario`,
    params
  );

  return publicUser(await getUserById(idUsuario));
}

async function deactivateUser(idUsuario, actor) {
  const current = await getUserById(idUsuario);
  validateManagePermission(actor, current.rol);

  if (actor && Number(actor.id_usuario) === Number(idUsuario)) {
    const error = new Error('No puedes desactivar tu propio usuario');
    error.status = 400;
    throw error;
  }

  await pool.execute(
    `UPDATE usuarios
     SET activo = 0
     WHERE id_usuario = :idUsuario`,
    { idUsuario }
  );

  return { ok: true, user: publicUser({ ...current, activo: 0 }) };
}

async function activateUser(idUsuario, actor) {
  const current = await getUserById(idUsuario);
  validateManagePermission(actor, current.rol);

  await pool.execute(
    `UPDATE usuarios
     SET activo = 1
     WHERE id_usuario = :idUsuario`,
    { idUsuario }
  );

  return { ok: true, user: publicUser({ ...current, activo: 1 }) };
}

async function login({ username, password }) {
  if (!username || !password) {
    const error = new Error('username y password son requeridos');
    error.status = 400;
    throw error;
  }

  const [rows] = await pool.execute(
    `SELECT id_usuario, nombre, username, password_hash, rol, activo, debe_cambiar_password
     FROM usuarios
     WHERE username = :username
     LIMIT 1`,
    { username }
  );

  const user = rows[0];
  if (!user || !user.activo) {
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  return publicUser({
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    username: user.username,
    rol: user.rol,
    activo: user.activo,
    debe_cambiar_password: user.debe_cambiar_password
  });
}

async function cambiarPassword(idUsuario, { nueva_password }) {
  if (!nueva_password || nueva_password.trim().length < 6) {
    const error = new Error('La nueva contrasena debe tener al menos 6 caracteres');
    error.status = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(nueva_password, 10);
  await pool.execute(
    `UPDATE usuarios
     SET password_hash = :passwordHash, debe_cambiar_password = 0
     WHERE id_usuario = :idUsuario`,
    { passwordHash, idUsuario }
  );
}

module.exports = {
  ROLES,
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  login,
  cambiarPassword
};
