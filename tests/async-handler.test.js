'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const asyncHandler = require('../src/utils/async-handler');

test('async-handler', async (t) => {
  await t.test('ejecuta el handler y no llama next cuando resuelve', async () => {
    let nextArg = 'no-llamado';
    const req = {};
    const res = {};
    const handler = asyncHandler(async (r, s) => {
      s.ok = true;
    });

    await handler(req, res, (err) => {
      nextArg = err;
    });

    assert.equal(res.ok, true);
    assert.equal(nextArg, 'no-llamado');
  });

  await t.test('captura promesas rechazadas y las pasa a next(err)', async () => {
    const boom = new Error('fallo async');
    let captured = null;
    const handler = asyncHandler(async () => {
      throw boom;
    });

    await handler({}, {}, (err) => {
      captured = err;
    });

    assert.equal(captured, boom);
  });

  await t.test('propaga el valor de retorno del handler', async () => {
    const handler = asyncHandler((req, res) => {
      res.value = 42;
      return Promise.resolve('listo');
    });
    const res = {};
    await handler({}, res, () => {});
    assert.equal(res.value, 42);
  });
});
