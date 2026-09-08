# Bloques de código para las Pruebas Unitarias (SI-KOIDE)

Fragmento de código real del sistema que corresponde a cada fila **"Bloque de código."**
del documento `IS_PLA_PruebasUnitariasDeSoftware_SI-KOIDE_V2.0.docx`.

Cada bloque está recortado a 6–12 líneas para que sea **legible dentro de la tabla de Word**
(sugerencia: fuente Consolas 8 pt, fondo gris claro, y arriba del bloque la línea
`Ubicación: archivo:línea` en cursiva).

Arquitectura de referencia: `routes → controllers → services → db` (Node.js + Express + MySQL2, sesión con `express-session`).

---

## SPRINT 1: MÓDULO ADMINISTRADOR

### PU-01 (RSP-01) — Bloqueo de acceso por credenciales inválidas
**Sección:** Capa de Servicios → Autenticación
**Ubicación:** `src/services/user.service.js` · función `login()` · líneas 234–246

```js
const user = rows[0];
if (!user || !user.activo) {
  const error = new Error('Credenciales invalidas');
  error.status = 401;
  throw error;
}

const passwordOk = await bcrypt.compare(password, user.password_hash);
if (!passwordOk) {
  const error = new Error('Credenciales invalidas');
  error.status = 401;
  throw error;
}
```

---

### PU-02 (RSP-02) — Restricción de acceso por nivel de privilegios (Roles)
**Sección:** Capa de Middlewares → Control de Acceso Basado en Roles (RBAC)
**Ubicación:** `src/middlewares/auth.middleware.js` · función `requireRoles()` · líneas 10–24

```js
function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Sesion requerida' });
    }
    const role = req.session.user.role || req.session.user.rol;
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Permiso insuficiente' });
    }
    next();
  };
}
```

*Aplicación en la ruta protegida* — `src/routes/user.routes.js:19`:

```js
router.put('/:id', requireRoles(['admin', 'encargado']), asyncHandler(userController.updateUser));
```

---

### PU-03 (RSP-13) — Validación estricta de rutas por nivel de acceso
**Sección:** Capa de Rutas (API REST) → Declaración de permisos por endpoint
**Ubicación:** `src/routes/inventory.routes.js` · líneas 8, 28, 33–34

```js
router.use(requireSession);                    // 1) exige sesión activa

router.post('/',        requireRoles(['admin', 'encargado', 'operador']), asyncHandler(inventoryController.createInventoryItem));
router.put('/:id',      requireRoles(['admin']),                          asyncHandler(inventoryController.updateInventoryItem));
router.delete('/:id',   requireRoles(['admin']),                          asyncHandler(inventoryController.deleteInventoryItem));
// Un token de 'operador' sobre DELETE /api/inventario/:id → HTTP 403
```

---

### PU-04 (RSP-14) — Conexión y escritura persistente en MySQL
**Sección:** Capa de Datos → Pool de conexiones
**Ubicación:** `src/db/mysql.js` · líneas 1–15 (archivo completo)

```js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'koide_supply',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});

module.exports = pool;
```

*Retorno del ID autoincrementable* — `src/services/inventory.service.js:176`:

```js
return getAnyInventoryItem(result.insertId);
```

---

### PU-05 (RSP-16) — Prevención de datos corruptos mediante Rollback
**Sección:** Capa de Servicios → Manejo transaccional (MySQL InnoDB)
**Ubicación:** `src/services/order.service.js` · función `createOrder()` · líneas 159–162 y 214–221

```js
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  // ... INSERT ordenes + INSERT orden_detalle (n registros) ...
  await connection.commit();
  return getOrder(idOrden);
} catch (error) {
  await connection.rollback();   // deshace TODA la operación
  throw error;
} finally {
  connection.release();
}
```

---

### PU-06 (RSP-17) — Bloqueo de peticiones desde IPs externas
> ⚠️ **Atención:** en el código actual **no existe** un middleware de filtrado por IP.
> El registro de esta prueba en el documento no tiene respaldo en el repositorio.
> Tienes dos opciones: (a) cambiar el caso de prueba por lo que sí valida el
> arranque de red del servidor, o (b) implementar el middleware y luego documentarlo.

**(a) Sección que sí existe hoy** — Capa de Aplicación → Arranque del servidor
**Ubicación:** `src/server.js` · líneas 1–9 (archivo completo)

```js
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Koide Supply escuchando en http://localhost:${PORT}`);
});
```

**(b) Middleware propuesto** (habría que crearlo en `src/middlewares/network.middleware.js` y registrarlo en `src/app.js`):

```js
const RANGOS_INTRANET = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^127\./, /^::1$/];

function soloIntranet(req, res, next) {
  const ip = (req.ip || '').replace('::ffff:', '');
  if (!RANGOS_INTRANET.some((rango) => rango.test(ip))) {
    return res.status(403).json({ error: 'Acceso permitido solo desde la red interna' });
  }
  next();
}
```

---

## SPRINT 2: MÓDULO ENCARGADO

### PU-07 (RSP-03) — Consulta general del inventario disponible
**Sección:** Capa de Servicios → Inventario (consulta)
**Ubicación:** `src/services/inventory.service.js` · función `listInventory()` · líneas 41–56

```js
if (all) {
  let sql = `SELECT id_refaccion, descripcion, no_parte, ubicacion,
                    existencias, minimos, maximos, imagen_item, activo
             FROM inventario
             WHERE activo = 1`;
  const params = [];
  if (hasSearch) {
    sql += ` AND (descripcion LIKE ? OR no_parte LIKE ? OR ubicacion LIKE ?)`;
    params.push(search, search, search);
  }
  sql += `\n ORDER BY descripcion ASC`;
  const [rows] = await pool.execute(sql, params);
  return rows;
}
```

*Endpoint expuesto* — `src/routes/inventory.routes.js:10` → `GET /api/inventario` (HTTP 200 + JSON).

---

### PU-08 (RSP-07) — Validación de stock insuficiente en orden de salida
**Sección:** Capa de Servicios → Órdenes (regla de negocio de stock)
**Ubicación:** `src/services/order.service.js` · función `createOrder()` · líneas 187–205

```js
const [inventoryRows] = await connection.execute(
  `SELECT id_refaccion, existencias
   FROM inventario
   WHERE id_refaccion = ? AND activo = 1
   LIMIT 1`,
  [detalle.id_refaccion]
);

if (tipo === 'salida' && inventoryRows[0].existencias < Number(detalle.cantidad)) {
  const error = new Error(`Stock insuficiente para refaccion ${detalle.id_refaccion}`);
  error.status = 400;
  throw error;      // dispara el rollback: no se descuenta nada
}
```

---

### PU-09 (RSP-10) — Exportación del catálogo de inventario a formato documento
> ⚠️ **Nota:** la exportación **no se genera en el backend con buffer**, se arma en el
> cliente con un `Blob` de tipo Excel. Ajusta la redacción del "Resultado esperado".

**Sección:** Capa de Presentación (Frontend) → Exportación de reportes
**Ubicación:** `public/app.js` · función `exportMissingItems()` · líneas 858–903

```js
const rows = items.map((item) => `
  <tr>
    <td>${escapeHtml(item.descripcion)}</td>
    <td>${escapeHtml(item.no_parte)}</td>
    <td>${item.existencias}</td>
    <td>${item.minimos}</td>
  </tr>`).join('');

const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = `${fileLabel}-${new Date().toISOString().slice(0, 10)}.xls`;
link.click();
```

---

### PU-10 (RSP-11) — Registro automático en la bitácora de acciones
**Sección:** Capa de Servicios → Trazabilidad (mensajes del sistema)
**Ubicación:** `src/services/system-message.service.js` · líneas 3–14

```js
async function createSystemMessage({ type, message, userId = null, movementId = null }, connection = pool) {
  await connection.execute(
    `INSERT INTO mensajes_sistema (tipo, mensaje, id_usuario, id_movimiento)
     VALUES (:type, :message, :userId, :movementId)`,
    { type, message, userId, movementId }
  );
}
```

*Invocación al crear una orden* — `src/controllers/order.controller.js:29–33`:

```js
await createSystemMessage({
  type: 'orden_creada',
  message: `${req.session.user.nombre} creo la orden ${order.id_orden} de ${order.tipo}`,
  userId: req.session.user.id_usuario
});
```

---

### PU-11 (RSP-12) — Extracción del ID del usuario responsable
> ⚠️ **Nota:** el sistema **no usa JWT**, usa sesión de servidor (`express-session`)
> con cookie `httpOnly`. Cambia "token JWT" por "cookie de sesión" en el documento.

**Sección:** Capa de Middlewares → Validación de sesión
**Ubicación:** `src/middlewares/auth.middleware.js` · función `requireSession()` · líneas 1–8

```js
function requireSession(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Sesion requerida' });
  }
  req.session.user.role = req.session.user.role || req.session.user.rol;
  next();
}
```

*Consumo del ID extraído* — `src/controllers/order.controller.js:38`:

```js
const idUsuario = req.session.user.id_usuario;
```

---

### PU-12 (RSP-15) — Ordenamiento de la consulta histórica
**Sección:** Capa de Servicios → Movimientos / Bitácora (paginación y orden)
**Ubicación:** `src/services/movement.service.js` · función `listSystemMessages()` · líneas 170–179

```js
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
```

---

### PU-13 (RSP-18) — Estructuración y sanitización de datos para PDF
**Sección:** Capa de Servicios → Motor de reportes (PDF)
**Ubicación:** `src/services/pdf.service.js` · función `generateValePDF()` · líneas 7–8 y 36–38

```js
// 1) Estructuración: aplana los detalles de la orden a texto y suma cantidades
const materialList = order.detalles
  .map((d) => `${d.cantidad} x ${d.descripcion} (NP: ${d.no_parte || 'N/A'})`)
  .join(', ');
const quantitySum = order.detalles.reduce((acc, d) => acc + Number(d.cantidad), 0);

// 2) Inyección controlada en la plantilla HTML antes de compilar el Buffer
for (const [key, value] of Object.entries(data)) {
  html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
}
```

---

## SPRINT 3: MÓDULO OPERADOR

### PU-14 (RSP-04) — Registro exitoso de un nuevo producto (stock inicial 0)
**Sección:** Capa de Servicios → Inventario (alta con flujo de aprobación)
**Ubicación:** `src/services/inventory.service.js` · función `createInventoryItem()` · líneas 144–165

```js
const role = actor && (actor.role || actor.rol);
const requiresApproval = role === 'operador';
const estadoRevision = requiresApproval ? 'pendiente' : 'aprobado';
const activo = requiresApproval ? 0 : 1;

const [result] = await pool.execute(
  `INSERT INTO inventario (
     descripcion, no_parte, ubicacion, existencias, minimos, maximos,
     activo, estado_revision, id_solicitante_alta
   )
   VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,   // existencias = 0 forzado
  [descripcion, no_parte || null, ubicacion || null, minimos, maximos,
   activo, estadoRevision, actor ? actor.id_usuario : null]
);
```

---

### PU-15 (RSP-05) — Registro lógico de salida de producto exitosa
**Sección:** Capa de Servicios → Órdenes (confirmación, descuento de stock)
**Ubicación:** `src/services/order.service.js` · función `confirmOrder()` · líneas 300–313

```js
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
  [stockChange, detalle.id_refaccion]   // salida → 20 + (-5) = 15
);
```

---

### PU-16 (RSP-06) — Actualización simultánea de stock al procesar la orden
> ⚠️ **Nota:** no es un `TRIGGER` de MySQL; la sincronía se garantiza con una
> **transacción explícita** (`beginTransaction … commit`) más bloqueo `FOR UPDATE`.
> Recomiendo cambiar "Disparador automático" por "Transacción atómica de actualización".

**Sección:** Capa de Servicios → Órdenes (transacción atómica multi-tabla)
**Ubicación:** `src/services/order.service.js` · función `confirmOrder()` · líneas 285–329

```js
const [inventoryRows] = await connection.execute(
  `SELECT id_refaccion, existencias FROM inventario
   WHERE id_refaccion = ? AND activo = 1 FOR UPDATE`, [detalle.id_refaccion]);

await connection.execute(
  `UPDATE inventario SET existencias = existencias + ? WHERE id_refaccion = ?`,
  [stockChange, detalle.id_refaccion]);                       // tabla 1

await connection.execute(
  `INSERT INTO movimientos (id_refaccion, tipo, cantidad, id_usuario, id_orden)
   VALUES (?, ?, ?, ?, ?)`,
  [detalle.id_refaccion, order.tipo, detalle.cantidad, idUsuario, idOrden]);  // tabla 2

await connection.execute(
  `UPDATE ordenes SET estado = 'completado' WHERE id_orden = ?`, [idOrden]);  // tabla 3

await connection.commit();   // las 3 tablas se confirman al mismo tiempo
```

---

### PU-17 (RSP-08) — Aumento de stock mediante una Orden de Entrada
**Sección:** Capa de Servicios → Órdenes (suma de inventario y registro del movimiento)
**Ubicación:** `src/services/order.service.js` · función `confirmOrder()` · líneas 306–319

```js
const stockChange = order.tipo === 'entrada' ? detalle.cantidad : -detalle.cantidad;

await connection.execute(
  `UPDATE inventario
   SET existencias = existencias + ?
   WHERE id_refaccion = ?`,
  [stockChange, detalle.id_refaccion]   // entrada → 5 + 20 = 25
);

await connection.execute(
  `INSERT INTO movimientos (id_refaccion, tipo, cantidad, id_usuario, id_orden)
   VALUES (?, ?, ?, ?, ?)`,
  [detalle.id_refaccion, order.tipo, detalle.cantidad, idUsuario, idOrden]
);
```

---

### PU-18 (RSP-09) — Modificación del estado de una orden existente
**Sección:** Capa de Servicios → Órdenes (cambio de estado por llave primaria)
**Ubicación:** `src/services/order.service.js` · función `cancelOrder()` · líneas 339–353

```js
const [result] = await pool.execute(
  `UPDATE ordenes
   SET estado = 'cancelado'
   WHERE id_orden = ? AND estado = 'pendiente'`,   // bloquea cambios posteriores
  [idOrden]
);

if (result.affectedRows === 0) {
  const error = new Error('Orden no encontrada o no esta pendiente');
  error.status = 400;
  throw error;
}

return getOrder(idOrden);
```

---

## Resumen de ubicaciones

| Prueba | Archivo | Función / sección |
|---|---|---|
| PU-01 | `src/services/user.service.js` | `login()` |
| PU-02 | `src/middlewares/auth.middleware.js` | `requireRoles()` |
| PU-03 | `src/routes/inventory.routes.js` | declaración de rutas |
| PU-04 | `src/db/mysql.js` | pool de conexiones |
| PU-05 | `src/services/order.service.js` | `createOrder()` — rollback |
| PU-06 | *(no implementado)* | `src/server.js` / middleware propuesto |
| PU-07 | `src/services/inventory.service.js` | `listInventory()` |
| PU-08 | `src/services/order.service.js` | `createOrder()` — stock |
| PU-09 | `public/app.js` | `exportMissingItems()` |
| PU-10 | `src/services/system-message.service.js` | `createSystemMessage()` |
| PU-11 | `src/middlewares/auth.middleware.js` | `requireSession()` |
| PU-12 | `src/services/movement.service.js` | `listSystemMessages()` |
| PU-13 | `src/services/pdf.service.js` | `generateValePDF()` |
| PU-14 | `src/services/inventory.service.js` | `createInventoryItem()` |
| PU-15 | `src/services/order.service.js` | `confirmOrder()` — salida |
| PU-16 | `src/services/order.service.js` | `confirmOrder()` — transacción |
| PU-17 | `src/services/order.service.js` | `confirmOrder()` — entrada |
| PU-18 | `src/services/order.service.js` | `cancelOrder()` |

### Puntos a corregir en el documento Word

1. **PU-06** — No existe filtrado por IP en el código. Reemplazar el caso o implementar el middleware.
2. **PU-11** — El sistema usa `express-session`, no JWT. Cambiar "token JWT" por "cookie de sesión".
3. **PU-16** — No hay `TRIGGER` de MySQL; es una transacción explícita con `FOR UPDATE`. Renombrar el caso.
4. **PU-09** — El archivo Excel se genera en el navegador (`Blob`), no como Buffer en el backend.
