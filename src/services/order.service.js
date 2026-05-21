const pool = require('../db/mysql');

function validateOrderPayload({ tipo, id_operador, detalles }) {
  if (!['entrada', 'salida'].includes(tipo)) {
    const error = new Error('tipo debe ser entrada o salida');
    error.status = 400;
    throw error;
  }

  if (!id_operador) {
    const error = new Error('id_operador es requerido');
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    const error = new Error('detalles debe incluir al menos una refaccion');
    error.status = 400;
    throw error;
  }

  detalles.forEach((detalle) => {
    if (!detalle.id_refaccion || !Number.isInteger(Number(detalle.cantidad)) || Number(detalle.cantidad) <= 0) {
      const error = new Error('Cada detalle requiere id_refaccion y cantidad mayor a 0');
      error.status = 400;
      throw error;
    }
  });
}

// Acepta filtros opcionales:
//   { date: 'YYYY-MM-DD' }         → resultado plano de ese dia (comportamiento admin)
//   { idOperador: N }              → solo ordenes de ese operador
//   { historyPage, historyLimit }  → pagina del historico (ordenes > 72 h)
//
// Sin `date`: devuelve { recent: [...], history: { items, pagination } }
//   recent  = todas las ordenes de las ultimas 72 horas
//   history = ordenes anteriores a 72 h, paginadas
//
// Con `date`: devuelve array plano (igual que antes)
async function listOrders({ date = null, idOperador = null, historyPage = 1, historyLimit = 25 } = {}) {
  const hasDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const hasOperador = Number.isInteger(Number(idOperador)) && Number(idOperador) > 0;

  const operadorCondition = hasOperador ? 'AND o.id_operador = ?' : '';
  const operadorParam = hasOperador ? [Number(idOperador)] : [];

  const orderSelect = `
    SELECT o.id_orden, o.tipo, o.solicitante, o.turno, o.maquina, o.numero_empleado,
           o.id_operador, u.nombre AS operador, o.estado, o.fecha,
           EXISTS (
             SELECT 1
             FROM movimientos m
             WHERE m.id_orden = o.id_orden
               AND m.es_reversion = 0
               AND NOT EXISTS (
                 SELECT 1
                 FROM movimientos r
                 WHERE r.id_movimiento_origen = m.id_movimiento
               )
           ) AS puede_revertir
    FROM ordenes o
    INNER JOIN usuarios u ON u.id_usuario = o.id_operador`;

  // ── Modo filtro de fecha: resultado plano (flujo original del admin) ──
  if (hasDate) {
    const conditions = [`DATE(o.fecha) = ?`];
    const params = [date];
    if (hasOperador) {
      conditions.push('o.id_operador = ?');
      params.push(Number(idOperador));
    }
    const sql = `${orderSelect} WHERE ${conditions.join(' AND ')} ORDER BY o.fecha DESC, o.id_orden DESC`;
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  // ── Modo dual: recientes (72 h) + historico paginado ──
  const safePage = Math.max(Number(historyPage) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(historyLimit) || 25, 1), 100);
  const offset = (safePage - 1) * safeLimit;

  const [recent] = await pool.execute(
    `${orderSelect}
     WHERE o.fecha >= NOW() - INTERVAL 72 HOUR
     ${operadorCondition}
     ORDER BY o.fecha DESC, o.id_orden DESC`,
    operadorParam
  );

  const [historyRows] = await pool.execute(
    `${orderSelect}
     WHERE o.fecha < NOW() - INTERVAL 72 HOUR
     ${operadorCondition}
     ORDER BY o.fecha DESC, o.id_orden DESC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    operadorParam
  );

  const [[countRow]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM ordenes o
     WHERE o.fecha < NOW() - INTERVAL 72 HOUR
     ${operadorCondition}`,
    operadorParam
  );

  const total = Number(countRow.total || 0);

  return {
    recent,
    history: {
      items: historyRows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(Math.ceil(total / safeLimit), 1)
      }
    }
  };
}

async function getOrder(idOrden) {
  const [orders] = await pool.execute(
    `SELECT o.id_orden, o.tipo, o.solicitante, o.turno, o.maquina, o.numero_empleado,
            o.id_operador, u.nombre AS operador, o.estado, o.fecha
     FROM ordenes o
     INNER JOIN usuarios u ON u.id_usuario = o.id_operador
     WHERE o.id_orden = ?
     LIMIT 1`,
    [idOrden]
  );

  if (!orders[0]) {
    const error = new Error('Orden no encontrada');
    error.status = 404;
    throw error;
  }

  const [detalles] = await pool.execute(
    `SELECT od.id_detalle, od.id_refaccion, i.descripcion, i.no_parte, od.cantidad
     FROM orden_detalle od
     INNER JOIN inventario i ON i.id_refaccion = od.id_refaccion
     WHERE od.id_orden = ?
     ORDER BY od.id_detalle ASC`,
    [idOrden]
  );

  return {
    ...orders[0],
    detalles
  };
}

async function createOrder({ tipo, solicitante, turno, maquina, numero_empleado, id_operador, detalles }) {
  validateOrderPayload({ tipo, id_operador, detalles });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      `SELECT id_usuario
       FROM usuarios
       WHERE id_usuario = ? AND activo = 1
       LIMIT 1`,
      [id_operador]
    );

    if (!userRows[0]) {
      const error = new Error('Operador no encontrado o inactivo');
      error.status = 400;
      throw error;
    }

    const [orderResult] = await connection.execute(
      `INSERT INTO ordenes (tipo, solicitante, turno, maquina, numero_empleado, id_operador, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [tipo, solicitante || null, turno || null, maquina || null, numero_empleado || null, id_operador]
    );

    const idOrden = orderResult.insertId;

    for (const detalle of detalles) {
      const [inventoryRows] = await connection.execute(
        `SELECT id_refaccion, existencias
         FROM inventario
         WHERE id_refaccion = ? AND activo = 1
         LIMIT 1`,
        [detalle.id_refaccion]
      );

      if (!inventoryRows[0]) {
        const error = new Error(`Refaccion ${detalle.id_refaccion} no encontrada o inactiva`);
        error.status = 400;
        throw error;
      }

      if (tipo === 'salida' && inventoryRows[0].existencias < Number(detalle.cantidad)) {
        const error = new Error(`Stock insuficiente para refaccion ${detalle.id_refaccion}`);
        error.status = 400;
        throw error;
      }

      await connection.execute(
        `INSERT INTO orden_detalle (id_orden, id_refaccion, cantidad)
         VALUES (?, ?, ?)`,
        [idOrden, detalle.id_refaccion, Number(detalle.cantidad)]
      );
    }

    await connection.commit();
    return getOrder(idOrden);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function confirmOrder(idOrden, idUsuario) {
  if (!idUsuario) {
    const error = new Error('id_usuario es requerido para confirmar la orden');
    error.status = 400;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      `SELECT id_usuario
       FROM usuarios
       WHERE id_usuario = ? AND activo = 1
       LIMIT 1`,
      [idUsuario]
    );

    if (!userRows[0]) {
      const error = new Error('Usuario no encontrado o inactivo');
      error.status = 400;
      throw error;
    }

    const [orderRows] = await connection.execute(
      `SELECT id_orden, tipo, estado
       FROM ordenes
       WHERE id_orden = ?
       FOR UPDATE`,
      [idOrden]
    );

    const order = orderRows[0];
    if (!order) {
      const error = new Error('Orden no encontrada');
      error.status = 404;
      throw error;
    }

    if (order.estado !== 'pendiente') {
      const error = new Error('Solo se pueden confirmar ordenes pendientes');
      error.status = 400;
      throw error;
    }

    const [detalles] = await connection.execute(
      `SELECT id_refaccion, cantidad
       FROM orden_detalle
       WHERE id_orden = ?`,
      [idOrden]
    );

    if (detalles.length === 0) {
      const error = new Error('La orden no tiene detalles');
      error.status = 400;
      throw error;
    }

    for (const detalle of detalles) {
      const [inventoryRows] = await connection.execute(
        `SELECT id_refaccion, existencias
         FROM inventario
         WHERE id_refaccion = ? AND activo = 1
         FOR UPDATE`,
        [detalle.id_refaccion]
      );

      const item = inventoryRows[0];
      if (!item) {
        const error = new Error(`Refaccion ${detalle.id_refaccion} no encontrada o inactiva`);
        error.status = 400;
        throw error;
      }

      if (order.tipo === 'salida' && item.existencias < detalle.cantidad) {
        const error = new Error(`Stock insuficiente para refaccion ${detalle.id_refaccion}`);
        error.status = 400;
        throw error;
      }

      const stockChange = order.tipo === 'entrada' ? detalle.cantidad : -detalle.cantidad;

      await connection.execute(
        `UPDATE inventario
         SET existencias = existencias + ?
         WHERE id_refaccion = ?`,
        [stockChange, detalle.id_refaccion]
      );

      await connection.execute(
        `INSERT INTO movimientos (id_refaccion, tipo, cantidad, id_usuario, id_orden)
         VALUES (?, ?, ?, ?, ?)`,
        [detalle.id_refaccion, order.tipo, detalle.cantidad, idUsuario, idOrden]
      );
    }

    await connection.execute(
      `UPDATE ordenes
       SET estado = 'completado'
       WHERE id_orden = ?`,
      [idOrden]
    );

    await connection.commit();
    return getOrder(idOrden);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelOrder(idOrden) {
  const [result] = await pool.execute(
    `UPDATE ordenes
     SET estado = 'cancelado'
     WHERE id_orden = ? AND estado = 'pendiente'`,
    [idOrden]
  );

  if (result.affectedRows === 0) {
    const error = new Error('Orden no encontrada o no esta pendiente');
    error.status = 400;
    throw error;
  }

  return getOrder(idOrden);
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  confirmOrder,
  cancelOrder
};
