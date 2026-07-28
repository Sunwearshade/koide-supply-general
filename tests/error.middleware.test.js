'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { notFoundHandler, errorHandler } = require('../src/middlewares/error.middleware');

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

test('notFoundHandler pasa un error 404 a next', () => {
  let passed = null;
  notFoundHandler({}, mockRes(), (err) => {
    passed = err;
  });
  assert.equal(passed.status, 404);
  assert.equal(passed.message, 'Ruta no encontrada');
});

test('errorHandler', async (t) => {
  await t.test('respeta status y message del error', () => {
    const res = mockRes();
    errorHandler({ status: 400, message: 'dato invalido' }, {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'dato invalido' });
  });

  await t.test('usa 500 y mensaje generico por defecto', () => {
    const res = mockRes();
    // Silenciamos console.error para no ensuciar la salida de la prueba.
    const original = console.error;
    console.error = () => {};
    try {
      errorHandler({}, {}, res, () => {});
    } finally {
      console.error = original;
    }
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Error interno del servidor');
  });
});
