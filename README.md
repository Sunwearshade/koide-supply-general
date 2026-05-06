# Koide Supply

MVP de gestion de almacen con Node.js, Express y MySQL.

## Preparacion

1. Crear la base de datos usando `db/schema.sql` o el dump de phpMyAdmin.
2. Copiar `.env.example` a `.env`.
3. Ajustar usuario y password de MySQL en `.env`.
4. Instalar dependencias:

```bash
npm install
```

5. Iniciar el servidor:

```bash
npm run dev
```

## Rutas principales

### Usuarios

- `POST /api/usuarios`
- `POST /api/usuarios/login`
- `GET /api/usuarios/me`
- `POST /api/usuarios/logout`

### Inventario

- `GET /api/inventario`
- `GET /api/inventario/:id`
- `POST /api/inventario`
- `PUT /api/inventario/:id`
- `DELETE /api/inventario/:id`

El CRUD de inventario no permite modificar `existencias` manualmente. Una refaccion nueva inicia con stock `0`.

### Ordenes

- `GET /api/ordenes`
- `GET /api/ordenes/:id`
- `POST /api/ordenes`
- `POST /api/ordenes/:id/confirmar`
- `POST /api/ordenes/:id/cancelar`

Ejemplo para crear una orden:

```json
{
  "tipo": "entrada",
  "solicitante": "Almacen",
  "id_operador": 1,
  "detalles": [
    {
      "id_refaccion": 1,
      "cantidad": 5
    }
  ]
}
```

Ejemplo para confirmar una orden:

```json
{
  "id_usuario": 1
}
```

### Movimientos

- `GET /api/movimientos`

Los movimientos se generan al confirmar ordenes y siempre quedan asociados a un usuario.
