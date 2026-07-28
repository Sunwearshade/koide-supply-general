'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFakePool, installMockPool, router } = require('./helpers/mock-db');

const pool = createFakePool();
installMockPool(pool);

const inventoryService = require('../src/services/inventory.service');

// Handler comun para createInventoryItem: insert + comprobacion de columna + lectura.
function createItemHandler({ insertId = 5 } = {}) {
  return router([
    [/INSERT INTO inventario/, { insertId }],
    [/information_schema/, [{ total: 0 }]], // tableHasColumn -> no existe columna 'id'
    [/FROM inventario i/, [{ id_refaccion: insertId, descripcion: 'Item', activo: 1 }]]
  ]);
}

test('createInventoryItem', async (t) => {
  await t.test('400 si falta descripcion', async () => {
    await assert.rejects(() => inventoryService.createInventoryItem({}), /descripcion es requerida/);
  });

  await t.test('un operador crea el item como pendiente e inactivo', async () => {
    pool.calls.length = 0;
    pool.setHandler(createItemHandler());
    await inventoryService.createInventoryItem(
      { descripcion: 'Tornillo' },
      { id_usuario: 2, role: 'operador' }
    );
    const insert = pool.calls.find((c) => /INSERT INTO inventario/.test(c.sql || ''));
    // params: [descripcion, no_parte, ubicacion, minimos, maximos, activo, estado_revision, id_solicitante]
    assert.equal(insert.params[5], 0, 'activo debe ser 0');
    assert.equal(insert.params[6], 'pendiente', 'estado_revision debe ser pendiente');
    assert.equal(insert.params[7], 2, 'debe registrar al solicitante');
  });

  await t.test('un admin crea el item como aprobado y activo', async () => {
    pool.calls.length = 0;
    pool.setHandler(createItemHandler());
    await inventoryService.createInventoryItem(
      { descripcion: 'Tuerca' },
      { id_usuario: 1, role: 'admin' }
    );
    const insert = pool.calls.find((c) => /INSERT INTO inventario/.test(c.sql || ''));
    assert.equal(insert.params[5], 1, 'activo debe ser 1');
    assert.equal(insert.params[6], 'aprobado', 'estado_revision debe ser aprobado');
  });

  await t.test('el stock inicial siempre es 0', async () => {
    pool.calls.length = 0;
    pool.setHandler(createItemHandler());
    await inventoryService.createInventoryItem({ descripcion: 'Arandela' });
    const insert = pool.calls.find((c) => /INSERT INTO inventario/.test(c.sql || ''));
    // El SQL fija existencias = 0 literalmente (no viene por parametro).
    assert.match(insert.sql, /existencias/);
    assert.match(insert.sql, /VALUES \(\?, \?, \?, 0,/);
  });
});

test('updateInventoryItem no ejecuta UPDATE cuando no hay campos', async () => {
  pool.calls.length = 0;
  pool.setHandler(
    router([[/FROM inventario\s+WHERE id_refaccion/, [{ id_refaccion: 1, descripcion: 'A' }]]])
  );
  const result = await inventoryService.updateInventoryItem(1, {});
  assert.equal(result.id_refaccion, 1);
  assert.ok(
    !pool.calls.some((c) => /UPDATE inventario/.test(c.sql || '')),
    'no debe ejecutar ningun UPDATE'
  );
});

test('deleteInventoryItem hace baja logica (activo = 0)', async () => {
  pool.calls.length = 0;
  pool.setHandler(
    router([[/FROM inventario\s+WHERE id_refaccion/, [{ id_refaccion: 1, descripcion: 'A' }]]])
  );
  const result = await inventoryService.deleteInventoryItem(1);
  assert.deepEqual(result, { ok: true });
  const update = pool.calls.find((c) => /UPDATE inventario SET activo = 0/.test(c.sql || ''));
  assert.ok(update, 'debe marcar activo = 0');
});

test('uploadInventoryImage - validaciones de imagen', async (t) => {
  const itemRoute = [/FROM inventario i/, [{ id_refaccion: 1, descripcion: 'Item' }]];

  await t.test('rechaza tipos MIME no permitidos', async () => {
    pool.setHandler(router([itemRoute]));
    await assert.rejects(
      () => inventoryService.uploadInventoryImage(1, { mimeType: 'text/plain', base64: 'abc' }),
      /Solo se permiten imagenes/
    );
  });

  await t.test('rechaza cuando no llega la imagen', async () => {
    pool.setHandler(router([itemRoute]));
    await assert.rejects(
      () => inventoryService.uploadInventoryImage(1, { mimeType: 'image/png' }),
      /No se recibio la imagen/
    );
  });
});
