const pool = require('../db/mysql');

async function listMovements() {
  const [rows] = await pool.execute(
    `SELECT m.id_movimiento, m.id_refaccion, i.descripcion, i.no_parte,
            m.tipo, m.cantidad, m.id_usuario, u.nombre AS usuario,
            m.id_orden, m.id_movimiento_origen, m.es_reversion, m.motivo, m.fecha,
            EXISTS (
              SELECT 1
              FROM movimientos r
              WHERE r.id_movimiento_origen = m.id_movimiento
            ) AS fue_revertido
     FROM movimientos m
     INNER JOIN inventario i ON i.id_refaccion = m.id_refaccion
     INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
     ORDER BY m.fecha DESC, m.id_movimiento DESC`
  );

  return rows;
}

async function revertMovement(idMovimiento, actor, motivo = 'Correccion operativa') {
  if (!actor) {
    const error = new Error('Sesion requerida');
    error.status = 401;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [movementRows] = await connection.execute(
      `SELECT m.id_movimiento, m.id_refaccion, m.tipo, m.cantidad, m.id_usuario, m.id_orden,
              m.id_movimiento_origen, m.es_reversion, i.descripcion, i.existencias, u.nombre AS usuario
       FROM movimientos m
       INNER JOIN inventario i ON i.id_refaccion = m.id_refaccion
       INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
       WHERE m.id_movimiento = :idMovimiento
       FOR UPDATE`,
      { idMovimiento }
    );

    const original = movementRows[0];
    if (!original) {
      const error = new Error('Movimiento no encontrado');
      error.status = 404;
      throw error;
    }

    if (original.es_reversion) {
      const error = new Error('No se puede revertir una reversion');
      error.status = 400;
      throw error;
    }

    const role = actor.role || actor.rol;
    if (role === 'operador' && original.id_usuario !== actor.id_usuario) {
      const error = new Error('Solo puedes revertir tus propios movimientos');
      error.status = 403;
      throw error;
    }

    const [reversalRows] = await connection.execute(
      `SELECT id_movimiento
       FROM movimientos
       WHERE id_movimiento_origen = :idMovimiento
       LIMIT 1`,
      { idMovimiento }
    );

    if (reversalRows[0]) {
      const error = new Error('Este movimiento ya fue revertido');
      error.status = 400;
      throw error;
    }

    const reverseType = original.tipo === 'entrada' ? 'salida' : 'entrada';
    const stockChange = reverseType === 'entrada' ? original.cantidad : -original.cantidad;

    if (reverseType === 'salida' && original.existencias < original.cantidad) {
      const error = new Error('Stock insuficiente para revertir esta entrada');
      error.status = 400;
      throw error;
    }

    await connection.execute(
      `UPDATE inventario
       SET existencias = existencias + :stockChange
       WHERE id_refaccion = :idRefaccion`,
      {
        stockChange,
        idRefaccion: original.id_refaccion
      }
    );

    const [result] = await connection.execute(
      `INSERT INTO movimientos (
        id_refaccion, tipo, cantidad, id_usuario, id_orden,
        id_movimiento_origen, es_reversion, motivo
      )
       VALUES (
        :idRefaccion, :tipo, :cantidad, :idUsuario, :idOrden,
        :idMovimientoOrigen, 1, :motivo
      )`,
      {
        idRefaccion: original.id_refaccion,
        tipo: reverseType,
        cantidad: original.cantidad,
        idUsuario: actor.id_usuario,
        idOrden: original.id_orden,
        idMovimientoOrigen: original.id_movimiento,
        motivo
      }
    );

    const idReversion = result.insertId;
    const message = `operador ${actor.nombre} deshizo una ${original.tipo} de ${original.cantidad} pieza(s) de ${original.descripcion}`;

    await connection.execute(
      `INSERT INTO mensajes_sistema (tipo, mensaje, id_usuario, id_movimiento)
       VALUES ('reversion_movimiento', :message, :idUsuario, :idMovimiento)`,
      {
        message,
        idUsuario: actor.id_usuario,
        idMovimiento: idReversion
      }
    );

    await connection.execute(
      `INSERT INTO documentos_movimiento (id_movimiento, tipo_documento, contenido)
       VALUES (:idMovimiento, 'reversion_movimiento', CAST(:contenido AS JSON))`,
      {
        idMovimiento: idReversion,
        contenido: JSON.stringify({
          titulo: 'Permiso de actualizacion de inventario',
          accion: 'reversion_movimiento',
          movimiento_original: original.id_movimiento,
          movimiento_reversion: idReversion,
          refaccion: {
            id_refaccion: original.id_refaccion,
            descripcion: original.descripcion
          },
          usuario: {
            id_usuario: actor.id_usuario,
            nombre: actor.nombre,
            rol: role
          },
          tipo_original: original.tipo,
          tipo_reversion: reverseType,
          cantidad: original.cantidad,
          motivo
        })
      }
    );

    await connection.commit();

    return {
      id_movimiento: idReversion,
      mensaje: message
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listSystemMessages({ q = '', dateFrom = '', dateTo = '', page = 1, limit = 25 } = {}) {
  const search = String(q || '').trim();
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const offset = (safePage - 1) * safeLimit;
  const filters = [];
  const params = {};

  if (search) {
    filters.push(`(ms.mensaje LIKE :search OR u.nombre LIKE :search)`);
    params.search = `%${search}%`;
  }

  if (dateFrom) {
    filters.push(`DATE(ms.fecha) >= :dateFrom`);
    params.dateFrom = dateFrom;
  }

  if (dateTo) {
    filters.push(`DATE(ms.fecha) <= :dateTo`);
    params.dateTo = dateTo;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT ms.id_mensaje, ms.tipo, ms.mensaje, ms.id_usuario, u.nombre AS usuario,
            ms.id_movimiento, ms.fecha
     FROM mensajes_sistema ms
     LEFT JOIN usuarios u ON u.id_usuario = ms.id_usuario
     ${whereClause}
     ORDER BY ms.fecha DESC, ms.id_mensaje DESC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    params
  );

  const [[countRow]] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM mensajes_sistema ms
     LEFT JOIN usuarios u ON u.id_usuario = ms.id_usuario
     ${whereClause}`,
    params
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

async function getMovementDocument(idMovimiento) {
  const [rows] = await pool.execute(
    `SELECT id_documento, id_movimiento, tipo_documento, contenido, fecha
     FROM documentos_movimiento
     WHERE id_movimiento = :idMovimiento
     ORDER BY fecha DESC
     LIMIT 1`,
    { idMovimiento }
  );

  if (!rows[0]) {
    const error = new Error('Documento no encontrado');
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function revertOrderMovements(idOrden, actor, motivo = 'Correccion operativa') {
  if (!actor) {
    const error = new Error('Sesion requerida');
    error.status = 401;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [movements] = await connection.execute(
      `SELECT m.id_movimiento, m.id_refaccion, m.tipo, m.cantidad, m.id_usuario, m.id_orden,
              m.id_movimiento_origen, m.es_reversion, i.descripcion, i.existencias
       FROM movimientos m
       INNER JOIN inventario i ON i.id_refaccion = m.id_refaccion
       WHERE m.id_orden = :idOrden
         AND m.es_reversion = 0
         AND NOT EXISTS (
           SELECT 1
           FROM movimientos r
           WHERE r.id_movimiento_origen = m.id_movimiento
         )
       FOR UPDATE`,
      { idOrden }
    );

    if (movements.length === 0) {
      const error = new Error('La orden no tiene movimientos reversibles');
      error.status = 400;
      throw error;
    }

    const role = actor.role || actor.rol;
    const created = [];

    for (const original of movements) {
      if (role === 'operador' && original.id_usuario !== actor.id_usuario) {
        const error = new Error('Solo puedes revertir tus propios movimientos');
        error.status = 403;
        throw error;
      }

      const reverseType = original.tipo === 'entrada' ? 'salida' : 'entrada';
      const stockChange = reverseType === 'entrada' ? original.cantidad : -original.cantidad;

      if (reverseType === 'salida' && original.existencias < original.cantidad) {
        const error = new Error(`Stock insuficiente para revertir ${original.descripcion}`);
        error.status = 400;
        throw error;
      }

      await connection.execute(
        `UPDATE inventario
         SET existencias = existencias + :stockChange
         WHERE id_refaccion = :idRefaccion`,
        {
          stockChange,
          idRefaccion: original.id_refaccion
        }
      );

      const [result] = await connection.execute(
        `INSERT INTO movimientos (
          id_refaccion, tipo, cantidad, id_usuario, id_orden,
          id_movimiento_origen, es_reversion, motivo
        )
         VALUES (
          :idRefaccion, :tipo, :cantidad, :idUsuario, :idOrden,
          :idMovimientoOrigen, 1, :motivo
        )`,
        {
          idRefaccion: original.id_refaccion,
          tipo: reverseType,
          cantidad: original.cantidad,
          idUsuario: actor.id_usuario,
          idOrden: original.id_orden,
          idMovimientoOrigen: original.id_movimiento,
          motivo
        }
      );

      const idReversion = result.insertId;
      const message = `operador ${actor.nombre} deshizo una ${original.tipo} de ${original.cantidad} pieza(s) de ${original.descripcion}`;

      await connection.execute(
        `INSERT INTO mensajes_sistema (tipo, mensaje, id_usuario, id_movimiento)
         VALUES ('reversion_movimiento', :message, :idUsuario, :idMovimiento)`,
        {
          message,
          idUsuario: actor.id_usuario,
          idMovimiento: idReversion
        }
      );

      await connection.execute(
        `INSERT INTO documentos_movimiento (id_movimiento, tipo_documento, contenido)
         VALUES (:idMovimiento, 'reversion_movimiento', CAST(:contenido AS JSON))`,
        {
          idMovimiento: idReversion,
          contenido: JSON.stringify({
            titulo: 'Permiso de actualizacion de inventario',
            accion: 'reversion_orden',
            id_orden: original.id_orden,
            movimiento_original: original.id_movimiento,
            movimiento_reversion: idReversion,
            refaccion: {
              id_refaccion: original.id_refaccion,
              descripcion: original.descripcion
            },
            usuario: {
              id_usuario: actor.id_usuario,
              nombre: actor.nombre,
              rol: role
            },
            tipo_original: original.tipo,
            tipo_reversion: reverseType,
            cantidad: original.cantidad,
            motivo
          })
        }
      );

      created.push({
        id_movimiento: idReversion,
        mensaje: message
      });
    }

    await connection.commit();
    return created;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listMovements,
  revertMovement,
  listSystemMessages,
  getMovementDocument,
  revertOrderMovements
};
