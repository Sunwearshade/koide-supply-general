const pool = require('../db/mysql');

const PERIODS = {
  weekly: 7,
  monthly: 30
};

function normalizePeriod(period) {
  return PERIODS[period] ? period : 'weekly';
}

function daysForPeriod(period) {
  return PERIODS[normalizePeriod(period)];
}

async function getMissingProducts() {
  const [rows] = await pool.execute(
    `SELECT id_refaccion, descripcion, no_parte, ubicacion, existencias, minimos, maximos,
            CASE
              WHEN existencias = 0 THEN 'critica'
              ELSE 'faltante'
            END AS prioridad
     FROM inventario
     WHERE activo = 1
       AND existencias <= minimos
     ORDER BY existencias ASC, descripcion ASC`
  );

  return rows;
}

async function getPriorityProducts() {
  const [rows] = await pool.execute(
    `SELECT id_refaccion, descripcion, no_parte, ubicacion, existencias, minimos, maximos,
            CASE
              WHEN existencias = 0 THEN 'critica'
              ELSE 'faltante'
            END AS prioridad,
            GREATEST(maximos - existencias, 0) AS sugerido_compra
     FROM inventario
     WHERE activo = 1
       AND minimos > 0
       AND existencias <= minimos
     ORDER BY existencias ASC, sugerido_compra DESC, descripcion ASC`
  );

  return rows;
}

async function getProductFlow(period = 'weekly') {
  const days = daysForPeriod(period);
  const [rows] = await pool.execute(
    `SELECT i.id_refaccion, i.descripcion, i.no_parte,
            SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END) AS entradas,
            SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END) AS salidas,
            COUNT(*) AS movimientos
     FROM movimientos m
     INNER JOIN inventario i ON i.id_refaccion = m.id_refaccion
     WHERE m.fecha >= DATE_SUB(NOW(), INTERVAL :days DAY)
     GROUP BY i.id_refaccion, i.descripcion, i.no_parte
     ORDER BY (entradas + salidas) DESC, i.descripcion ASC`,
    { days }
  );

  return rows;
}

async function getReport(period = 'weekly') {
  const normalizedPeriod = normalizePeriod(period);
  const [missingProducts, priorityProducts, productFlow] = await Promise.all([
    getMissingProducts(),
    getPriorityProducts(),
    getProductFlow(normalizedPeriod)
  ]);

  return {
    period: normalizedPeriod,
    missingProducts,
    priorityProducts,
    productFlow
  };
}

async function getStats(period = 'weekly') {
  const normalizedPeriod = normalizePeriod(period);
  const days = daysForPeriod(normalizedPeriod);

  const [[summary], [topOutputs], [topInputs], [lowStock], [recentMessages]] = await Promise.all([
    pool.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END), 0) AS entradas,
        COALESCE(SUM(CASE WHEN tipo = 'salida' THEN cantidad ELSE 0 END), 0) AS salidas,
        COUNT(*) AS movimientos
       FROM movimientos
       WHERE fecha >= DATE_SUB(NOW(), INTERVAL :days DAY)`,
      { days }
    ),
    pool.execute(
      `SELECT i.descripcion, i.no_parte, SUM(m.cantidad) AS cantidad
       FROM movimientos m
       INNER JOIN inventario i ON i.id_refaccion = m.id_refaccion
       WHERE m.tipo = 'salida'
         AND m.fecha >= DATE_SUB(NOW(), INTERVAL :days DAY)
       GROUP BY i.id_refaccion, i.descripcion, i.no_parte
       ORDER BY cantidad DESC
       LIMIT 5`,
      { days }
    ),
    pool.execute(
      `SELECT i.descripcion, i.no_parte, SUM(m.cantidad) AS cantidad
       FROM movimientos m
       INNER JOIN inventario i ON i.id_refaccion = m.id_refaccion
       WHERE m.tipo = 'entrada'
         AND m.fecha >= DATE_SUB(NOW(), INTERVAL :days DAY)
       GROUP BY i.id_refaccion, i.descripcion, i.no_parte
       ORDER BY cantidad DESC
       LIMIT 5`,
      { days }
    ),
    pool.execute(
      `SELECT id_refaccion, descripcion, no_parte, existencias, minimos
       FROM inventario
       WHERE activo = 1
         AND existencias <= minimos
       ORDER BY existencias ASC, descripcion ASC
       LIMIT 10`
    ),
    pool.execute(
      `SELECT id_mensaje, mensaje, fecha
       FROM mensajes_sistema
       ORDER BY fecha DESC, id_mensaje DESC
       LIMIT 8`
    )
  ]);

  return {
    period: normalizedPeriod,
    summary: summary[0],
    topOutputs,
    topInputs,
    lowStock,
    recentMessages
  };
}

module.exports = {
  getReport,
  getStats
};
