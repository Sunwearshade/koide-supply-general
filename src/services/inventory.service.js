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

  const insertedId = result.insertId;

  // La BD tiene 'id' como PK auto_increment y 'id_refaccion' como columna separada.
  // Sincronizamos id_refaccion = id para que todos los lookups funcionen correctamente.
  await pool.execute(
    `UPDATE inventario SET id_refaccion = ? WHERE id = ? AND (id_refaccion IS NULL OR id_refaccion = 0)`,
    [insertedId, insertedId]
  );

  return getAnyInventoryItem(insertedId);
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

const ADJUSTABLE_FIELDS = ['existencias', 'descripcion', 'no_parte', 'ubicacion', 'minimos', 'maximos'];

async function saveAdjustmentDraft(items, actor) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Se requiere al menos un item para ajustar');
    error.status = 400;
    throw error;
  }

  const { getAdjustmentMode } = require('./config.service');
  const mode = await getAdjustmentMode();

  if (mode.estado !== 'activo') {
    const error = new Error('El modo de ajuste no esta activo para edición.');
    error.status = 403;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of items) {
      if (!item.id_refaccion) continue;

      const marcarEliminar = item.marcar_eliminar ? 1 : 0;

      if (marcarEliminar) {
        // Solo guardar la bandera de eliminación
        await connection.execute(
          `INSERT INTO ajuste_inventario_borrador (id_item, marcar_eliminar, id_usuario)
           VALUES (:idItem, 1, :idUsuario)
           ON DUPLICATE KEY UPDATE marcar_eliminar = 1, id_usuario = :idUsuario, fecha = CURRENT_TIMESTAMP`,
          { idItem: item.id_refaccion, idUsuario: actor.id_usuario }
        );
        continue;
      }

      const setClauses = [];
      const updateParams = { idItem: item.id_refaccion, idUsuario: actor.id_usuario };

      for (const field of ADJUSTABLE_FIELDS) {
        if (item[field] !== undefined) {
          setClauses.push(`${field} = :${field}`);
          updateParams[field] = field === 'existencias' || field === 'minimos' || field === 'maximos'
            ? Number(item[field])
            : (item[field] === '' ? '' : (item[field] || null));
        }
      }

      if (setClauses.length > 0) {
        await connection.execute(
          `INSERT INTO ajuste_inventario_borrador (id_item, id_usuario, ${ADJUSTABLE_FIELDS.filter(f => item[f] !== undefined).join(', ')})
           VALUES (:idItem, :idUsuario, ${ADJUSTABLE_FIELDS.filter(f => item[f] !== undefined).map(f => `:${f}`).join(', ')})
           ON DUPLICATE KEY UPDATE ${setClauses.join(', ')}, marcar_eliminar = 0, id_usuario = :idUsuario, fecha = CURRENT_TIMESTAMP`,
          updateParams
        );
      }
    }

    await connection.commit();

    return { ok: true, items_procesados: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAdjustmentDraft() {
  const [rows] = await pool.execute(
    `SELECT b.id_item as id_refaccion, b.descripcion, b.no_parte, b.ubicacion, b.existencias, b.minimos, b.maximos,
            b.marcar_eliminar,
            b.id_usuario, b.fecha,
            i.descripcion as old_descripcion, i.no_parte as old_no_parte, i.ubicacion as old_ubicacion,
            i.existencias as old_existencias, i.minimos as old_minimos, i.maximos as old_maximos,
            u.nombre as modificado_por
     FROM ajuste_inventario_borrador b
     INNER JOIN inventario i ON i.id_refaccion = b.id_item
     LEFT JOIN usuarios u ON u.id_usuario = b.id_usuario`
  );

  return rows;
}

async function saveAdjustmentNewItems(items, actor) {
  if (!Array.isArray(items)) return { ok: true };

  const { getAdjustmentMode } = require('./config.service');
  const mode = await getAdjustmentMode();
  if (mode.estado !== 'activo') {
    const error = new Error('El modo de ajuste no esta activo.');
    error.status = 403;
    throw error;
  }

  // Reemplaza todos los nuevos del usuario con la lista actual
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM ajuste_inventario_nuevos WHERE id_usuario = ?`, [actor.id_usuario]);

    for (const item of items) {
      if (!item.descripcion || !item.descripcion.trim()) continue;
      await connection.execute(
        `INSERT INTO ajuste_inventario_nuevos (descripcion, no_parte, ubicacion, existencias, minimos, maximos, id_usuario)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.descripcion.trim(),
          item.no_parte || null,
          item.ubicacion || null,
          Number(item.existencias) || 0,
          Number(item.minimos) || 0,
          Number(item.maximos) || 0,
          actor.id_usuario
        ]
      );
    }

    await connection.commit();
    return { ok: true, items_guardados: items.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAdjustmentNewItems() {
  const [rows] = await pool.execute(
    `SELECT n.id_nuevo, n.descripcion, n.no_parte, n.ubicacion, n.existencias, n.minimos, n.maximos,
            n.id_usuario, u.nombre AS agregado_por, n.fecha
     FROM ajuste_inventario_nuevos n
     LEFT JOIN usuarios u ON u.id_usuario = n.id_usuario
     ORDER BY n.fecha ASC, n.id_nuevo ASC`
  );
  return rows;
}

async function approveAdjustmentDraft(actor) {
  const { getAdjustmentMode, setAdjustmentMode } = require('./config.service');
  const mode = await getAdjustmentMode();

  if (mode.estado !== 'en_revision') {
    const error = new Error('No hay un ajuste pendiente de revisión.');
    error.status = 400;
    throw error;
  }

  const drafts = await getAdjustmentDraft();
  const newItems = await getAdjustmentNewItems();

  const connection = await pool.getConnection();
  let totalChanges = 0;

  try {
    await connection.beginTransaction();

    // 1. Aplicar ediciones a items existentes
    for (const draft of drafts) {
      if (Number(draft.marcar_eliminar) === 1) continue; // se procesa abajo

      const setClauses = [];
      const updateParams = {};

      for (const field of ADJUSTABLE_FIELDS) {
        const oldVal = draft[`old_${field}`];
        const newVal = draft[field];

        if (newVal === null || newVal === undefined) continue;

        const oldStr = oldVal === null || oldVal === undefined ? '' : String(oldVal);
        const newStr = newVal === null || newVal === undefined ? '' : String(newVal);

        if (oldStr === newStr) continue;

        setClauses.push(`${field} = :${field}`);
        updateParams[field] = newVal;

        await connection.execute(
          `INSERT INTO log_ajuste_inventario (id_item, campo_modificado, valor_anterior, valor_nuevo, id_usuario)
           VALUES (:idItem, :campo, :anterior, :nuevo, :idUsuario)`,
          {
            idItem: draft.id_refaccion,
            campo: field,
            anterior: oldStr || null,
            nuevo: newStr || null,
            idUsuario: actor.id_usuario
          }
        );

        totalChanges++;
      }

      if (setClauses.length > 0) {
        updateParams.idRefaccion = draft.id_refaccion;
        await connection.execute(
          `UPDATE inventario SET ${setClauses.join(', ')} WHERE id_refaccion = :idRefaccion`,
          updateParams
        );
      }
    }

    // 2. Desactivar items marcados para eliminar
    const toDelete = drafts.filter(d => Number(d.marcar_eliminar) === 1);
    for (const draft of toDelete) {
      await connection.execute(
        `UPDATE inventario SET activo = 0 WHERE id_refaccion = ?`,
        [draft.id_refaccion]
      );
      await connection.execute(
        `INSERT INTO log_ajuste_inventario (id_item, campo_modificado, valor_anterior, valor_nuevo, id_usuario)
         VALUES (?, 'activo', '1', '0 (eliminado en ajuste)', ?)`,
        [draft.id_refaccion, actor.id_usuario]
      );
      totalChanges++;
    }

    // 3. Crear nuevos items
    for (const item of newItems) {
      const [result] = await connection.execute(
        `INSERT INTO inventario (descripcion, no_parte, ubicacion, existencias, minimos, maximos, activo, estado_revision, id_aprobador_alta, fecha_revision)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'aprobado', ?, NOW())`,
        [
          item.descripcion, item.no_parte || null, item.ubicacion || null,
          item.existencias || 0, item.minimos || 0, item.maximos || 0,
          actor.id_usuario
        ]
      );
      await connection.execute(
        `INSERT INTO log_ajuste_inventario (id_item, campo_modificado, valor_anterior, valor_nuevo, id_usuario)
         VALUES (?, 'alta_ajuste', NULL, ?, ?)`,
        [result.insertId, item.descripcion, actor.id_usuario]
      );
      totalChanges++;
    }

    // 4. Registrar mensaje y limpiar borradores
    if (totalChanges > 0) {
      await connection.execute(
        `INSERT INTO mensajes_sistema (tipo, mensaje, id_usuario)
         VALUES ('ajuste_masivo_inventario', :mensaje, :idUsuario)`,
        {
          mensaje: `${actor.nombre} aplicó ajuste masivo: ${drafts.length - toDelete.length} edicion(es), ${toDelete.length} baja(s), ${newItems.length} alta(s)`,
          idUsuario: actor.id_usuario
        }
      );
    }

    await connection.execute(`DELETE FROM ajuste_inventario_borrador`);
    await connection.execute(`DELETE FROM ajuste_inventario_nuevos`);

    await connection.commit();
    await setAdjustmentMode('inactivo', actor);

    return {
      ok: true,
      ediciones: drafts.length - toDelete.length,
      eliminados: toDelete.length,
      agregados: newItems.length,
      cambios_realizados: totalChanges
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rejectAdjustmentDraft(actor) {
  const { getAdjustmentMode, setAdjustmentMode } = require('./config.service');
  const mode = await getAdjustmentMode();

  if (mode.estado !== 'en_revision') {
    const error = new Error('No hay un ajuste pendiente de revisión.');
    error.status = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM ajuste_inventario_borrador`);
    await connection.execute(`DELETE FROM ajuste_inventario_nuevos`);
    await connection.commit();
    await setAdjustmentMode('inactivo', actor);

    await pool.execute(
      `INSERT INTO mensajes_sistema (tipo, mensaje, id_usuario)
       VALUES ('ajuste_masivo_rechazado', :mensaje, :idUsuario)`,
      {
        mensaje: `${actor.nombre} rechazó y descartó el borrador de ajuste de inventario`,
        idUsuario: actor.id_usuario
      }
    );

    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAdjustmentLogs({ page = 1, limit = 50 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 5), 200);
  const offset = (safePage - 1) * safeLimit;

  const [rows] = await pool.execute(
    `SELECT l.id_log, l.id_item, i.descripcion, l.campo_modificado,
            l.valor_anterior, l.valor_nuevo, l.id_usuario, u.nombre AS usuario, l.fecha
     FROM log_ajuste_inventario l
     INNER JOIN inventario i ON i.id_refaccion = l.id_item
     INNER JOIN usuarios u ON u.id_usuario = l.id_usuario
     ORDER BY l.fecha DESC, l.id_log DESC
     LIMIT ${safeLimit} OFFSET ${offset}`
  );

  const [[countRow]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM log_ajuste_inventario`
  );

  const total = Number(countRow.total || 0);

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

module.exports = {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  listPendingInventory,
  approveInventoryItem,
  rejectInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  saveAdjustmentDraft,
  getAdjustmentDraft,
  saveAdjustmentNewItems,
  getAdjustmentNewItems,
  approveAdjustmentDraft,
  rejectAdjustmentDraft,
  getAdjustmentLogs
};
