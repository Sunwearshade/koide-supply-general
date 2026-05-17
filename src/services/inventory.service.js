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

async function getAnyInventoryItem(idRefaccion) {
  const [rows] = await pool.execute(
    `SELECT i.id_refaccion, i.descripcion, i.no_parte, i.ubicacion, i.existencias, i.minimos, i.maximos,
            i.activo, i.estado_revision, i.id_solicitante_alta, s.nombre AS solicitante_alta,
            i.id_aprobador_alta, a.nombre AS aprobador_alta, i.fecha_revision, i.created_at
     FROM inventario i
     LEFT JOIN usuarios s ON s.id_usuario = i.id_solicitante_alta
     LEFT JOIN usuarios a ON a.id_usuario = i.id_aprobador_alta
     WHERE i.id_refaccion = ?
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

async function createInventoryItem({ descripcion, no_parte, ubicacion, minimos = 0, maximos = 0 }, actor = null) {
  if (!descripcion) {
    const error = new Error('descripcion es requerida');
    error.status = 400;
    throw error;
  }

  const role = actor && (actor.role || actor.rol);
  const requiresApproval = role === 'operador';
  const estadoRevision = requiresApproval ? 'pendiente' : 'aprobado';
  const activo = requiresApproval ? 0 : 1;

  const [result] = await pool.execute(
    `INSERT INTO inventario (
      descripcion, no_parte, ubicacion, existencias, minimos, maximos,
      activo, estado_revision, id_solicitante_alta
    )
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      descripcion,
      no_parte || null,
      ubicacion || null,
      minimos,
      maximos,
      activo,
      estadoRevision,
      actor ? actor.id_usuario : null
    ]
  );

  return getAnyInventoryItem(result.insertId);
}

async function listPendingInventory() {
  const [rows] = await pool.execute(
    `SELECT i.id_refaccion, i.descripcion, i.no_parte, i.ubicacion, i.existencias, i.minimos, i.maximos,
            i.estado_revision, i.created_at, u.nombre AS solicitante_alta
     FROM inventario i
     LEFT JOIN usuarios u ON u.id_usuario = i.id_solicitante_alta
     WHERE i.estado_revision = 'pendiente'
     ORDER BY i.created_at ASC, i.descripcion ASC`
  );

  return rows;
}

async function approveInventoryItem(idRefaccion, actor) {
  const item = await getAnyInventoryItem(idRefaccion);

  if (item.estado_revision !== 'pendiente') {
    const error = new Error('La refaccion no tiene aprobacion pendiente');
    error.status = 400;
    throw error;
  }

  await pool.execute(
    `UPDATE inventario
     SET activo = 1,
         estado_revision = 'aprobado',
         id_aprobador_alta = ?,
         fecha_revision = NOW()
     WHERE id_refaccion = ?`,
    [actor.id_usuario, idRefaccion]
  );

  return getAnyInventoryItem(idRefaccion);
}

async function rejectInventoryItem(idRefaccion, actor) {
  const item = await getAnyInventoryItem(idRefaccion);

  if (item.estado_revision !== 'pendiente') {
    const error = new Error('La refaccion no tiene aprobacion pendiente');
    error.status = 400;
    throw error;
  }

  await pool.execute(
    `UPDATE inventario
     SET activo = 0,
         estado_revision = 'rechazado',
         id_aprobador_alta = ?,
         fecha_revision = NOW()
     WHERE id_refaccion = ?`,
    [actor.id_usuario, idRefaccion]
  );

  return getAnyInventoryItem(idRefaccion);
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
  listPendingInventory,
  approveInventoryItem,
  rejectInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
};
