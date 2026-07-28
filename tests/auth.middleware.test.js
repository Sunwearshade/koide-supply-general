'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  requireSession,
  requireRoles,
  requirePasswordChanged
} = require('../src/middlewares/auth.middleware');

// Fabrica un objeto res simulado que registra status()/json().
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('requireSession', async (t) => {
  await t.test('responde 401 si no hay usuario en sesion', () => {
    const res = mockRes();
    let called = false;
    requireSession({ session: {} }, res, () => {
      called = true;
    });
    assert.equal(res.statusCode, 401);
    assert.equal(called, false);
    assert.deepEqual(res.body, { error: 'Sesion requerida' });
  });

  await t.test('normaliza role desde rol y continua', () => {
    const req = { session: { user: { id_usuario: 1, rol: 'admin' } } };
    let called = false;
    requireSession(req, mockRes(), () => {
      called = true;
    });
    assert.equal(called, true);
    assert.equal(req.session.user.role, 'admin');
  });
});

test('requireRoles', async (t) => {
  await t.test('401 sin sesion', () => {
    const res = mockRes();
    requireRoles(['admin'])({ session: {} }, res, () => {});
    assert.equal(res.statusCode, 401);
  });

  await t.test('403 cuando el rol no esta permitido', () => {
    const res = mockRes();
    let called = false;
    requireRoles(['admin'])(
      { session: { user: { rol: 'operador' } } },
      res,
      () => {
        called = true;
      }
    );
    assert.equal(res.statusCode, 403);
    assert.equal(called, false);
  });

  await t.test('continua cuando el rol esta permitido (usa rol como fallback)', () => {
    let called = false;
    requireRoles(['admin', 'encargado'])(
      { session: { user: { rol: 'encargado' } } },
      mockRes(),
      () => {
        called = true;
      }
    );
    assert.equal(called, true);
  });
});

test('requirePasswordChanged', async (t) => {
  await t.test('continua si no hay usuario', () => {
    let called = false;
    requirePasswordChanged({ session: {} }, mockRes(), () => {
      called = true;
    });
    assert.equal(called, true);
  });

  await t.test('continua si el usuario no debe cambiar password', () => {
    let called = false;
    requirePasswordChanged(
      { session: { user: { debe_cambiar_password: 0 } }, baseUrl: '/api/inventario', path: '/' },
      mockRes(),
      () => {
        called = true;
      }
    );
    assert.equal(called, true);
  });

  await t.test('permite rutas de la lista blanca aunque deba cambiar password', () => {
    let called = false;
    requirePasswordChanged(
      {
        session: { user: { debe_cambiar_password: 1 } },
        baseUrl: '/api/usuarios',
        path: '/cambiar-password'
      },
      mockRes(),
      () => {
        called = true;
      }
    );
    assert.equal(called, true);
  });

  await t.test('bloquea con 403 rutas protegidas si debe cambiar password', () => {
    const res = mockRes();
    let called = false;
    requirePasswordChanged(
      {
        session: { user: { debe_cambiar_password: 1 } },
        baseUrl: '/api/inventario',
        path: '/'
      },
      res,
      () => {
        called = true;
      }
    );
    assert.equal(res.statusCode, 403);
    assert.equal(called, false);
    assert.equal(res.body.debe_cambiar_password, true);
  });
});
