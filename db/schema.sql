CREATE DATABASE IF NOT EXISTS koide_supply;
USE koide_supply;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario int NOT NULL AUTO_INCREMENT,
  nombre varchar(100) NOT NULL,
  username varchar(50) NOT NULL,
  password_hash varchar(255) NOT NULL,
  rol enum('admin','encargado','operador') NOT NULL,
  activo tinyint(1) DEFAULT '1',
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS inventario (
  id_refaccion int NOT NULL AUTO_INCREMENT,
  descripcion varchar(255) NOT NULL,
  no_parte varchar(100) DEFAULT NULL,
  ubicacion varchar(50) DEFAULT NULL,
  existencias int DEFAULT '0',
  minimos int DEFAULT '0',
  maximos int DEFAULT '0',
  activo tinyint(1) DEFAULT '1',
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_refaccion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ordenes (
  id_orden int NOT NULL AUTO_INCREMENT,
  tipo enum('entrada','salida') NOT NULL,
  solicitante varchar(100) DEFAULT NULL,
  turno enum('A','B','C') DEFAULT NULL,
  maquina varchar(100) DEFAULT NULL,
  numero_empleado varchar(50) DEFAULT NULL,
  id_operador int NOT NULL,
  estado enum('pendiente','completado','cancelado') DEFAULT 'pendiente',
  fecha datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_orden),
  KEY id_operador (id_operador),
  CONSTRAINT ordenes_ibfk_1 FOREIGN KEY (id_operador) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS orden_detalle (
  id_detalle int NOT NULL AUTO_INCREMENT,
  id_orden int NOT NULL,
  id_refaccion int NOT NULL,
  cantidad int NOT NULL,
  PRIMARY KEY (id_detalle),
  KEY id_orden (id_orden),
  KEY id_refaccion (id_refaccion),
  CONSTRAINT orden_detalle_ibfk_1 FOREIGN KEY (id_orden) REFERENCES ordenes (id_orden),
  CONSTRAINT orden_detalle_ibfk_2 FOREIGN KEY (id_refaccion) REFERENCES inventario (id_refaccion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS movimientos (
  id_movimiento int NOT NULL AUTO_INCREMENT,
  id_refaccion int NOT NULL,
  tipo enum('entrada','salida') NOT NULL,
  cantidad int NOT NULL,
  id_usuario int NOT NULL,
  id_orden int DEFAULT NULL,
  id_movimiento_origen int DEFAULT NULL,
  es_reversion tinyint(1) DEFAULT '0',
  motivo varchar(255) DEFAULT NULL,
  fecha datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_movimiento),
  KEY id_refaccion (id_refaccion),
  KEY id_usuario (id_usuario),
  KEY id_orden (id_orden),
  KEY id_movimiento_origen (id_movimiento_origen),
  CONSTRAINT movimientos_ibfk_1 FOREIGN KEY (id_refaccion) REFERENCES inventario (id_refaccion),
  CONSTRAINT movimientos_ibfk_2 FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT movimientos_ibfk_3 FOREIGN KEY (id_orden) REFERENCES ordenes (id_orden),
  CONSTRAINT movimientos_ibfk_4 FOREIGN KEY (id_movimiento_origen) REFERENCES movimientos (id_movimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS mensajes_sistema (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS documentos_movimiento (
  id_documento int NOT NULL AUTO_INCREMENT,
  id_movimiento int NOT NULL,
  tipo_documento enum('permiso_actualizacion_inventario','reversion_movimiento') NOT NULL,
  contenido json NOT NULL,
  fecha datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_documento),
  KEY id_movimiento (id_movimiento),
  CONSTRAINT documentos_movimiento_ibfk_1 FOREIGN KEY (id_movimiento) REFERENCES movimientos (id_movimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
