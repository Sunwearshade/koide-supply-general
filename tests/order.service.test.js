'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFakePool, installMockPool, router } = require('./helpers/mock-db');

const pool = createFakePool();
installMockPool(pool);

const orderService = require('../src/services/order.service');

test('createOrder - validacion del payload', async (t) => {
  const base = { id_operador: 1, detalles: [{ id_refaccion: 1, cantidad: 2 }] };

  await t.test("rechaza tipo distinto de entrada/salida", async () => {
    await assert.rejects(
      () => orderService.createOrder({ ...base, tipo: 'otro' }),
      /tipo debe ser entrada o salida/
    );
  });

  await t.test('exige id_operador', async () => {
    await assert.rejects(
      () => orderService.createOrder({ tipo: 'entrada', detalles: base.detalles }),
      /id_operador es requerido/
    );
  });

  await t.test('exige al menos un detalle', async () => {
    await assert.rejects(
      () => orderService.createOrder({ tipo: 'entrada', id_operador: 1, detalles: [] }),
      /al menos una refaccion/
    );
  });

  await t.test('rechaza cantidades no positivas', async () => {
    await assert.rejects(
      () =>
        orderService.createOrder({
          tipo: 'entrada',
          id_operador: 1,
          detalles: [{ id_refaccion: 1, cantidad: 0 }]
        }),
      /cantidad mayor a 0/
    );
  });
});

test('createOrder - reglas de negocio', async (t) => {
  await t.test('400 si el operador no existe o esta inactivo', async () => {
    pool.setHandler(router([[/SELECT id_usuario\s+FROM usuarios/, []]]));
    await assert.rejects(
      () =>
        orderService.createOrder({
          tipo: 'entrada',
          id_operador: 999,
          detalles: [{ id_refaccion: 1, cantidad: 1 }]
        }),
      /Operador no encontrado o inactivo/
    );
  });

  await t.test('400 por stock insuficiente en una salida', async () => {
    pool.setHandler(
      router([
        [/SELECT id_usuario\s+FROM usuarios/, [{ id_usuario: 1 }]],
        [/INSERT INTO ordenes/, { insertId: 1 }],
        [/FROM inventario/, [{ id_refaccion: 1, existencias: 2 }]]
      ])
    );
    await assert.rejects(
      () =>
        orderService.createOrder({
          tipo: 'salida',
          id_operador: 1,
          detalles: [{ id_refaccion: 1, cantidad: 5 }]
        }),
      /Stock insuficiente/
    );
  });

  await t.test('hace rollback ante un error de negocio', async () => {
    pool.calls.length = 0;
    pool.setHandler(router([[/SELECT id_usuario\s+FROM usuarios/, []]]));
    await assert.rejects(() =>
      orderService.createOrder({
        tipo: 'entrada',
        id_operador: 1,
        detalles: [{ id_refaccion: 1, cantidad: 1 }]
      })
    );
    assert.ok(pool.calls.some((c) => c.type === 'rollback'), 'debe hacer rollback');
    assert.ok(pool.calls.some((c) => c.type === 'release'), 'debe liberar la conexion');
  });
});

test('confirmOrder', async (t) => {
  await t.test('400 si falta id_usuario', async () => {
    await assert.rejects(() => orderService.confirmOrder(1, null), /id_usuario es requerido/);
  });

  await t.test('400 si la orden no esta pendiente', async () => {
    pool.setHandler(
      router([
        [/SELECT id_usuario\s+FROM usuarios/, [{ id_usuario: 1 }]],
        [/FROM ordenes\s+WHERE id_orden = \?\s+FOR UPDATE/, [{ id_orden: 1, tipo: 'salida', estado: 'completado' }]]
      ])
    );
    await assert.rejects(
      () => orderService.confirmOrder(1, 1),
      /Solo se pueden confirmar ordenes pendientes/
    );
  });
});

test('cancelOrder devuelve 400 si no hay orden pendiente que cancelar', async () => {
  pool.setHandler(router([[/UPDATE ordenes/, { affectedRows: 0 }]]));
  await assert.rejects(
    () => orderService.cancelOrder(1),
    /Orden no encontrada o no esta pendiente/
  );
});
