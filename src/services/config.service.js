const pool = require('../db/mysql');

async function getAdjustmentMode() {
  const [rows] = await pool.execute(
    `SELECT valor, updated_at, u.nombre AS updated_by_nombre
     FROM configuracion_sistema c
     LEFT JOIN usuarios u ON u.id_usuario = c.updated_by
     WHERE c.clave = 'modo_ajuste_inventario'
     LIMIT 1`
  );

  if (!rows[0]) {
    return { estado: 'inactivo', updated_at: null, updated_by: null };
  }

  let estado = rows[0].valor;
  if (estado === 'off') estado = 'inactivo';
  if (estado === 'on') estado = 'activo';

  return {
    estado,
    updated_at: rows[0].updated_at,
    updated_by: rows[0].updated_by_nombre
  };
}

async function setAdjustmentMode(nuevoEstado, actor) {
  const validStates = ['inactivo', 'activo', 'en_revision'];
  if (!validStates.includes(nuevoEstado)) {
    throw new Error('Estado inválido');
  }

  const [existing] = await pool.execute(
    `SELECT clave FROM configuracion_sistema WHERE clave = 'modo_ajuste_inventario' LIMIT 1`
  );

  if (existing.length === 0) {
    await pool.execute(
      `INSERT INTO configuracion_sistema (clave, valor, updated_at, updated_by)
       VALUES ('modo_ajuste_inventario', :valor, NOW(), :idUsuario)`,
      { valor: nuevoEstado, idUsuario: actor.id_usuario }
    );
  } else {
    await pool.execute(
      `UPDATE configuracion_sistema
       SET valor = :valor, updated_at = NOW(), updated_by = :idUsuario
       WHERE clave = 'modo_ajuste_inventario'`,
      { valor: nuevoEstado, idUsuario: actor.id_usuario }
    );
  }

  return { estado: nuevoEstado };
}

module.exports = {
  getAdjustmentMode,
  setAdjustmentMode
};
