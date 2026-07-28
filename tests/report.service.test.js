'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createFakePool, installMockPool } = require('./helpers/mock-db');

const pool = createFakePool();
installMockPool(pool);

const reportService = require('../src/services/report.service');

// getReport normaliza el periodo y traduce el periodo a dias para el flujo.
// Verificamos ambos comportamientos observando el valor de retorno y el
// parametro `days` que llega a la consulta de flujo de productos.
test('getReport normaliza el periodo', async (t) => {
  await t.test("periodo invalido cae a 'weekly' (7 dias)", async () => {
    pool.calls.length = 0;
    pool.setHandler(() => []);
    const report = await reportService.getReport('trimestral');
    assert.equal(report.period, 'weekly');
    const flowCall = pool.calls.find((c) => /FROM movimientos m/.test(c.sql || ''));
    assert.equal(flowCall.params.days, 7);
  });

  await t.test("'monthly' se conserva (30 dias)", async () => {
    pool.calls.length = 0;
    pool.setHandler(() => []);
    const report = await reportService.getReport('monthly');
    assert.equal(report.period, 'monthly');
    const flowCall = pool.calls.find((c) => /FROM movimientos m/.test(c.sql || ''));
    assert.equal(flowCall.params.days, 30);
  });

  await t.test('devuelve las tres secciones del reporte', async () => {
    pool.setHandler(() => []);
    const report = await reportService.getReport('weekly');
    assert.deepEqual(Object.keys(report).sort(), [
      'missingProducts',
      'period',
      'priorityProducts',
      'productFlow'
    ]);
  });
});
