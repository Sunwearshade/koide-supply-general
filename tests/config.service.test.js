'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFakePool, installMockPool, router } = require('./helpers/mock-db');

const pool = createFakePool();
installMockPool(pool);

const configService = require('../src/services/config.service');

test('getAdjustmentMode', async (t) => {
  await t.test('devuelve inactivo cuando no hay fila de configuracion', async () => {
    pool.setHandler(() => []);
    const mode = await configService.getAdjustmentMode();
    assert.deepEqual(mode, { estado: 'inactivo', updated_at: null, updated_by: null });
  });

  await t.test("mapea el valor legado 'off' a 'inactivo'", async () => {
    pool.setHandler(() => [{ valor: 'off', updated_at: '2026-01-01', updated_by_nombre: 'Ana' }]);
    const mode = await configService.getAdjustmentMode();
    assert.equal(mode.estado, 'inactivo');
    assert.equal(mode.updated_by, 'Ana');
  });

  await t.test("mapea el valor legado 'on' a 'activo'", async () => {
    pool.setHandler(() => [{ valor: 'on', updated_at: null, updated_by_nombre: null }]);
    const mode = await configService.getAdjustmentMode();
    assert.equal(mode.estado, 'activo');
  });

  await t.test("conserva estados nuevos como 'en_revision'", async () => {
    pool.setHandler(() => [{ valor: 'en_revision', updated_at: null, updated_by_nombre: null }]);
    const mode = await configService.getAdjustmentMode();
    assert.equal(mode.estado, 'en_revision');
  });
});

test('setAdjustmentMode', async (t) => {
  await t.test('rechaza estados invalidos', async () => {
    await assert.rejects(
      () => configService.setAdjustmentMode('cualquier-cosa', { id_usuario: 1 }),
      /Estado inválido/
    );
  });

  await t.test('inserta cuando la clave no existe', async () => {
    pool.calls.length = 0;
    pool.setHandler(
      router([
        [/SELECT clave FROM configuracion_sistema/, []] // no existe
      ])
    );
    const result = await configService.setAdjustmentMode('activo', { id_usuario: 7 });
    assert.deepEqual(result, { estado: 'activo' });
    const insertCall = pool.calls.find((c) => /INSERT INTO configuracion_sistema/.test(c.sql || ''));
    assert.ok(insertCall, 'debe ejecutar un INSERT');
    assert.equal(insertCall.params.valor, 'activo');
    assert.equal(insertCall.params.idUsuario, 7);
  });

  await t.test('actualiza cuando la clave ya existe', async () => {
    pool.calls.length = 0;
    pool.setHandler(
      router([
        [/SELECT clave FROM configuracion_sistema/, [{ clave: 'modo_ajuste_inventario' }]]
      ])
    );
    await configService.setAdjustmentMode('en_revision', { id_usuario: 3 });
    const updateCall = pool.calls.find((c) => /UPDATE configuracion_sistema/.test(c.sql || ''));
    assert.ok(updateCall, 'debe ejecutar un UPDATE');
    assert.equal(updateCall.params.valor, 'en_revision');
  });
});
