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

async function renameColumnIfNeeded(connection, tableName, oldColumnName, newColumnName, definition) {
  const hasOldColumn = await columnExists(connection, tableName, oldColumnName);
  const hasNewColumn = await columnExists(connection, tableName, newColumnName);

  if (hasOldColumn && !hasNewColumn) {
    await connection.query(`ALTER TABLE ${tableName} CHANGE COLUMN ${oldColumnName} ${newColumnName} ${definition}`);
  }
}

async function ensureInventoryIdAutoIncrement(connection) {
  const [columns] = await connection.execute(`SHOW COLUMNS FROM inventario`);
  const idRefaccion = columns.find((column) => column.Field === 'id_refaccion');
  const autoColumn = columns.find((column) => String(column.Extra || '').includes('auto_increment'));

  if (idRefaccion && String(idRefaccion.Extra || '').includes('auto_increment')) {
    return;
  }

  if (autoColumn && autoColumn.Field !== 'id_refaccion') {
    if (columns.some((column) => column.Field === 'id')) {
      await connection.query(`
        UPDATE inventario
        SET id_refaccion = id
        WHERE id_refaccion IS NULL OR id_refaccion = 0
      `);
      await addIndexIfMissing(connection, 'inventario', 'idx_inventario_id_refaccion', '(id_refaccion)');
    }
    return;
  }

  await connection.query(`
    ALTER TABLE inventario
    MODIFY COLUMN id_refaccion int NOT NULL AUTO_INCREMENT
  `);
}

async function copyLegacyImageItemColumn(connection) {
  const hasSpacedColumn = await columnExists(connection, 'inventario', 'imagen item');
  const hasCurrentColumn = await columnExists(connection, 'inventario', 'imagen_item');
  if (!hasSpacedColumn || !hasCurrentColumn) return;

  await connection.query(`
    UPDATE inventario
    SET imagen_item = COALESCE(imagen_item, \`imagen item\`)
  `);
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
    await renameColumnIfNeeded(connection, 'inventario', 'imagen_path', 'imagen_item', 'varchar(255) DEFAULT NULL');
    await addColumnIfMissing(connection, 'inventario', 'imagen_item', 'varchar(255) DEFAULT NULL');
    await copyLegacyImageItemColumn(connection);
    await ensureInventoryIdAutoIncrement(connection);
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

    await connection.query(
      `CREATE TABLE IF NOT EXISTS configuracion_sistema (
        clave varchar(100) NOT NULL,
        valor varchar(500) DEFAULT NULL,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by int DEFAULT NULL,
        PRIMARY KEY (clave),
        KEY updated_by (updated_by),
        CONSTRAINT configuracion_sistema_ibfk_1 FOREIGN KEY (updated_by) REFERENCES usuarios (id_usuario)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await connection.query(
      `INSERT IGNORE INTO configuracion_sistema (clave, valor)
       VALUES ('modo_ajuste_inventario', 'off')`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS log_ajuste_inventario (
        id_log int NOT NULL AUTO_INCREMENT,
        id_item int NOT NULL,
        campo_modificado varchar(50) NOT NULL,
        valor_anterior varchar(255) DEFAULT NULL,
        valor_nuevo varchar(255) DEFAULT NULL,
        id_usuario int NOT NULL,
        fecha datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_log),
        KEY log_ajuste_inv_item (id_item),
        KEY log_ajuste_inv_usuario (id_usuario),
        CONSTRAINT log_ajuste_inv_ibfk_2 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await connection.query(
      `CREATE TABLE IF NOT EXISTS ajuste_inventario_borrador (
        id_item int NOT NULL,
        descripcion varchar(255) DEFAULT NULL,
        no_parte varchar(100) DEFAULT NULL,
        ubicacion varchar(50) DEFAULT NULL,
        existencias int DEFAULT NULL,
        minimos int DEFAULT NULL,
        maximos int DEFAULT NULL,
        id_usuario int NOT NULL,
        fecha datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id_item),
        KEY id_usuario (id_usuario),
        CONSTRAINT ajuste_borrador_ibfk_2 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await addColumnIfMissing(
      connection,
      'usuarios',
      'debe_cambiar_password',
      "tinyint(1) NOT NULL DEFAULT '0'"
    );

    // Borrador de ajuste: soporte para marcar filas a eliminar
    await addColumnIfMissing(
      connection,
      'ajuste_inventario_borrador',
      'marcar_eliminar',
      "tinyint(1) NOT NULL DEFAULT '0'"
    );

    // Nuevas filas que el encargado desea agregar al inventario
    await connection.query(
      `CREATE TABLE IF NOT EXISTS ajuste_inventario_nuevos (
        id_nuevo    int          NOT NULL AUTO_INCREMENT,
        descripcion varchar(255) NOT NULL,
        no_parte    varchar(100) DEFAULT NULL,
        ubicacion   varchar(50)  DEFAULT NULL,
        existencias int          DEFAULT 0,
        minimos     int          DEFAULT 0,
        maximos     int          DEFAULT 0,
        imagen_item varchar(255) DEFAULT NULL,
        id_usuario  int          NOT NULL,
        fecha       datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id_nuevo),
        KEY id_usuario (id_usuario),
        CONSTRAINT ajuste_nuevos_ibfk_1 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    await addColumnIfMissing(connection, 'ajuste_inventario_nuevos', 'imagen_item', 'varchar(255) DEFAULT NULL');

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
