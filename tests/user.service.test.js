'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { createFakePool, installMockPool, router } = require('./helpers/mock-db');

const pool = createFakePool();
installMockPool(pool);

const userService = require('../src/services/user.service');

test('login', async (t) => {
  await t.test('400 si faltan credenciales', async () => {
    await assert.rejects(() => userService.login({ username: 'x' }), /requeridos/);
  });

  await t.test('401 si el usuario no existe', async () => {
    pool.setHandler(() => []);
    await assert.rejects(
      () => userService.login({ username: 'nadie', password: 'secreta' }),
      /Credenciales invalidas/
    );
  });

  await t.test('401 si el usuario esta inactivo', async () => {
    const hash = await bcrypt.hash('secreta', 10);
    pool.setHandler(() => [
      { id_usuario: 1, username: 'ana', password_hash: hash, rol: 'admin', activo: 0 }
    ]);
    await assert.rejects(
      () => userService.login({ username: 'ana', password: 'secreta' }),
      /Credenciales invalidas/
    );
  });

  await t.test('401 si la contrasena es incorrecta', async () => {
    const hash = await bcrypt.hash('correcta', 10);
    pool.setHandler(() => [
      { id_usuario: 1, username: 'ana', password_hash: hash, rol: 'admin', activo: 1 }
    ]);
    await assert.rejects(
      () => userService.login({ username: 'ana', password: 'incorrecta' }),
      /Credenciales invalidas/
    );
  });

  await t.test('devuelve el usuario publico con credenciales validas', async () => {
    const hash = await bcrypt.hash('correcta', 10);
    pool.setHandler(() => [
      {
        id_usuario: 9,
        nombre: 'Ana',
        username: 'ana',
        password_hash: hash,
        rol: 'encargado',
        activo: 1,
        debe_cambiar_password: 1
      }
    ]);
    const user = await userService.login({ username: 'ana', password: 'correcta' });
    assert.equal(user.id_usuario, 9);
    assert.equal(user.role, 'encargado');
    assert.equal(user.rol, 'encargado');
    assert.equal(user.debe_cambiar_password, true);
    // Nunca debe exponer el hash de la contrasena.
    assert.equal(user.password_hash, undefined);
  });
});

test('createUser', async (t) => {
  await t.test('400 si faltan campos', async () => {
    await assert.rejects(
      () => userService.createUser({ nombre: 'A', username: 'a', password: 'x' }),
      /requeridos/
    );
  });

  await t.test('400 si el rol es invalido', async () => {
    await assert.rejects(
      () => userService.createUser({ nombre: 'A', username: 'a', password: 'xxxxxx', rol: 'jefe' }),
      /rol invalido/
    );
  });

  await t.test('400 si el primer usuario no es administrador general', async () => {
    pool.setHandler(router([[/COUNT\(\*\) AS total FROM usuarios/, [{ total: 0 }]]]));
    await assert.rejects(
      () => userService.createUser({ nombre: 'A', username: 'a', password: 'xxxxxx', rol: 'operador' }),
      /primer usuario debe ser administrador/
    );
  });

  await t.test('crea el primer usuario admin correctamente', async () => {
    pool.setHandler(
      router([
        [/COUNT\(\*\) AS total FROM usuarios/, [{ total: 0 }]],
        [/INSERT INTO usuarios/, { insertId: 100 }]
      ])
    );
    const user = await userService.createUser({
      nombre: 'Root',
      username: 'root',
      password: 'segura1',
      rol: 'admin'
    });
    assert.equal(user.id_usuario, 100);
    assert.equal(user.rol, 'admin');
    assert.equal(user.debe_cambiar_password, true);
  });

  await t.test('401 si no hay actor y ya existen usuarios', async () => {
    pool.setHandler(router([[/COUNT\(\*\) AS total FROM usuarios/, [{ total: 3 }]]]));
    await assert.rejects(
      () => userService.createUser({ nombre: 'B', username: 'b', password: 'xxxxxx', rol: 'operador' }),
      /Sesion requerida/
    );
  });

  await t.test('403 si un operador intenta crear usuarios', async () => {
    pool.setHandler(router([[/COUNT\(\*\) AS total FROM usuarios/, [{ total: 3 }]]]));
    await assert.rejects(
      () =>
        userService.createUser(
          { nombre: 'B', username: 'b', password: 'xxxxxx', rol: 'operador' },
          { role: 'operador' }
        ),
      /Permiso insuficiente/
    );
  });

  await t.test('un encargado puede crear un operador', async () => {
    pool.setHandler(
      router([
        [/COUNT\(\*\) AS total FROM usuarios/, [{ total: 3 }]],
        [/INSERT INTO usuarios/, { insertId: 55 }]
      ])
    );
    const user = await userService.createUser(
      { nombre: 'Op', username: 'op', password: 'xxxxxx', rol: 'operador' },
      { role: 'encargado' }
    );
    assert.equal(user.id_usuario, 55);
  });
});

test('cambiarPassword', async (t) => {
  await t.test('400 si la contrasena es demasiado corta', async () => {
    await assert.rejects(
      () => userService.cambiarPassword(1, { nueva_password: '123' }),
      /al menos 6 caracteres/
    );
  });

  await t.test('actualiza el hash y limpia la bandera de cambio', async () => {
    pool.calls.length = 0;
    pool.setHandler(() => []);
    await userService.cambiarPassword(1, { nueva_password: 'nuevaSegura' });
    const update = pool.calls.find((c) => /UPDATE usuarios/.test(c.sql || ''));
    assert.ok(update, 'debe ejecutar el UPDATE');
    assert.ok(update.params.passwordHash, 'debe incluir el nuevo hash');
    assert.notEqual(update.params.passwordHash, 'nuevaSegura'); // hasheada, no en claro
  });
});

test('deactivateUser impide desactivar la propia cuenta', async () => {
  pool.setHandler(
    router([[/FROM\s+usuarios/, [{ id_usuario: 5, nombre: 'Ana', rol: 'operador', activo: 1 }]]])
  );
  await assert.rejects(
    () => userService.deactivateUser(5, { role: 'admin', id_usuario: 5 }),
    /No puedes desactivar tu propio usuario/
  );
});
