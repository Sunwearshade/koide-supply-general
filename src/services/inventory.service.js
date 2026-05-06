const pool = require('../db/mysql');

async function listInventory({ q = '', page = 1, limit = 25, all = false } = {}) {
  const trimmed = q.trim();
  const hasSearch = trimmed !== '';
  const search = `%${trimmed}%`;

  if (all) {
    let sql = `SELECT id_refaccion, descripcion, no_parte, ubicacion, existencias, minimos, maximos, activo
       FROM inventario
       WHERE activo = 1`;
    const params = [];

    if (hasSearch) {
      sql += `
         AND (descripcion LIKE ? OR no_parte LIKE ? OR ubicacion LIKE ?)`;
      params.push(search, search, search);
    }

    sql += `\n       ORDER BY descripcion ASC`;

    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 5), 100);
  const offset = (safePage - 1) * safeLimit;

  let baseSql = `FROM inventario WHERE activo = 1`;
  const baseParams = [];

  if (hasSearch) {
    baseSql += `
       AND (descripcion LIKE ? OR no_parte LIKE ? OR ubicacion LIKE ?)`;
    baseParams.push(search, search, search);
  }

  const [rows] = await pool.execute(
    `SELECT id_refaccion, descripcion, no_parte, ubicacion, existencias, minimos, maximos, activo
     ${baseSql}
     ORDER BY descripcion ASC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    baseParams
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total ${baseSql}`,
    baseParams
  );

  const total = countRows[0].total;
  return {
    items: rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1)
    }
  };
}

async function getInventoryItem(idRefaccion) {
  const [rows] = await pool.execute(
    `SELECT id_refaccion, descripcion, no_parte, ubicacion, existencias, minimos, maximos, activo
     FROM inventario
     WHERE id_refaccion = ?
     LIMIT 1`,
    [idRefaccion]
  );

  if (!rows[0]) {
    const error = new Error('Refaccion no encontrada');
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function createInventoryItem({ descripcion, no_parte, ubicacion, minimos = 0, maximos = 0 }) {
  if (!descripcion) {
    const error = new Error('descripcion es requerida');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.execute(
    `INSERT INTO inventario (descripcion, no_parte, ubicacion, existencias, minimos, maximos)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [descripcion, no_parte || null, ubicacion || null, minimos, maximos]
  );

  return getInventoryItem(result.insertId);
}

async function updateInventoryItem(idRefaccion, { descripcion, no_parte, ubicacion, minimos, maximos, activo }) {
  await getInventoryItem(idRefaccion);

  const setClauses = [];
  const params = [];

  if (descripcion !== undefined) {
    setClauses.push('descripcion = ?');
    params.push(descripcion);
  }

  if (no_parte !== undefined) {
    setClauses.push('no_parte = ?');
    params.push(no_parte);
  }

  if (ubicacion !== undefined) {
    setClauses.push('ubicacion = ?');
    params.push(ubicacion);
  }

  if (minimos !== undefined) {
    setClauses.push('minimos = ?');
    params.push(minimos);
  }

  if (maximos !== undefined) {
    setClauses.push('maximos = ?');
    params.push(maximos);
  }

  if (activo !== undefined) {
    setClauses.push('activo = ?');
    params.push(activo ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return getInventoryItem(idRefaccion);
  }

  params.push(idRefaccion);

  await pool.execute(
    `UPDATE inventario SET ${setClauses.join(', ')} WHERE id_refaccion = ?`,
    params
  );

  return getInventoryItem(idRefaccion);
}

async function deleteInventoryItem(idRefaccion) {
  await getInventoryItem(idRefaccion);
  await pool.execute(
    `UPDATE inventario SET activo = 0 WHERE id_refaccion = ?`,
    [idRefaccion]
  );

  return { ok: true };
}

module.exports = {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
};
