require('dotenv').config();

const pool = require('../src/db/mysql');

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND COLUMN_NAME = :columnName`,
    { tableName, columnName }
  );

  return rows[0].total > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND INDEX_NAME = :indexName`,
    { tableName, indexName }
  );

  return rows[0].total > 0;
}

async function foreignKeyExists(connection, constraintName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND CONSTRAINT_NAME = :constraintName
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { constraintName }
  );

  return rows[0].total > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (await columnExists(connection, tableName, columnName)) return;
  await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function addIndexIfMissing(connection, tableName, indexName, definition) {
  if (await indexExists(connection, tableName, indexName)) return;
  await connection.query(`ALTER TABLE ${tableName} ADD KEY ${indexName} ${definition}`);
}

async function addForeignKeyIfMissing(connection, constraintName, sql) {
  if (await foreignKeyExists(connection, constraintName)) return;
  await connection.query(sql);
}

async function migrate() {
  const connection = await pool.getConnection();

  try {
    await addColumnIfMissing(connection, 'movimientos', 'id_movimiento_origen', 'int DEFAULT NULL');
    await addColumnIfMissing(connection, 'movimientos', 'es_reversion', "tinyint(1) DEFAULT '0'");
    await addColumnIfMissing(connection, 'movimientos', 'motivo', 'varchar(255) DEFAULT NULL');
    await addIndexIfMissing(connection, 'movimientos', 'id_movimiento_origen', '(id_movimiento_origen)');
    await addForeignKeyIfMissing(
      connection,
      'movimientos_ibfk_4',
      `ALTER TABLE movimientos
       ADD CONSTRAINT movimientos_ibfk_4
       FOREIGN KEY (id_movimiento_origen) REFERENCES movimientos (id_movimiento)`
    );

    await addColumnIfMissing(connection, 'ordenes', 'turno', "enum('A','B','C') DEFAULT NULL");
    await addColumnIfMissing(connection, 'ordenes', 'maquina', 'varchar(100) DEFAULT NULL');
    await addColumnIfMissing(connection, 'ordenes', 'numero_empleado', 'varchar(50) DEFAULT NULL');

    await addColumnIfMissing(connection, 'inventario', 'estado_revision', "enum('pendiente','aprobado','rechazado') DEFAULT 'aprobado'");
    await addColumnIfMissing(connection, 'inventario', 'id_solicitante_alta', 'int DEFAULT NULL');
    await addColumnIfMissing(connection, 'inventario', 'id_aprobador_alta', 'int DEFAULT NULL');
    await addColumnIfMissing(connection, 'inventario', 'fecha_revision', 'datetime DEFAULT NULL');
    await addIndexIfMissing(connection, 'inventario', 'id_solicitante_alta', '(id_solicitante_alta)');
    await addIndexIfMissing(connection, 'inventario', 'id_aprobador_alta', '(id_aprobador_alta)');
    await addForeignKeyIfMissing(
      connection,
      'inventario_ibfk_1',
      `ALTER TABLE inventario
       ADD CONSTRAINT inventario_ibfk_1
       FOREIGN KEY (id_solicitante_alta) REFERENCES usuarios (id_usuario)`
    );
    await addForeignKeyIfMissing(
      connection,
      'inventario_ibfk_2',
      `ALTER TABLE inventario
       ADD CONSTRAINT inventario_ibfk_2
       FOREIGN KEY (id_aprobador_alta) REFERENCES usuarios (id_usuario)`
    );
    await connection.query(
      `UPDATE inventario
       SET estado_revision = 'aprobado'
       WHERE estado_revision IS NULL`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS mensajes_sistema (
        id_mensaje int NOT NULL AUTO_INCREMENT,
        tipo varchar(50) NOT NULL,
        mensaje varchar(500) NOT NULL,
        id_usuario int DEFAULT NULL,
        id_movimiento int DEFAULT NULL,
        fecha datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_mensaje),
        KEY id_usuario (id_usuario),
        KEY id_movimiento (id_movimiento),
        CONSTRAINT mensajes_sistema_ibfk_1 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
        CONSTRAINT mensajes_sistema_ibfk_2 FOREIGN KEY (id_movimiento) REFERENCES movimientos (id_movimiento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS documentos_movimiento (
        id_documento int NOT NULL AUTO_INCREMENT,
        id_movimiento int NOT NULL,
        tipo_documento enum('permiso_actualizacion_inventario','reversion_movimiento') NOT NULL,
        contenido json NOT NULL,
        fecha datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_documento),
        KEY id_movimiento (id_movimiento),
        CONSTRAINT documentos_movimiento_ibfk_1 FOREIGN KEY (id_movimiento) REFERENCES movimientos (id_movimiento)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    console.log('Migracion completada');
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
