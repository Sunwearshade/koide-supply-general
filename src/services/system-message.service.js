const pool = require('../db/mysql');

async function createSystemMessage({ type, message, userId = null, movementId = null }, connection = pool) {
  await connection.execute(
    `INSERT INTO mensajes_sistema (tipo, mensaje, id_usuario, id_movimiento)
     VALUES (:type, :message, :userId, :movementId)`,
    {
      type,
      message,
      userId,
      movementId
    }
  );
}

module.exports = {
  createSystemMessage
};
