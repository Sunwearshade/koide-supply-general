# Pruebas unitarias — Koide Supply

Documentación de la suite de pruebas unitarias del backend (Node.js / Express / MySQL).

## Cómo ejecutarlas

```bash
npm test
```

Internamente ejecuta:

```bash
node --test tests/*.test.js
```

No se requiere ninguna dependencia adicional ni una base de datos en ejecución:
se usa el **test runner nativo de Node** (`node:test` + `node:assert/strict`),
disponible desde Node 18 (el proyecto corre en Node 24).

## Estrategia de diseño

El backend está organizado en capas (`routes → controllers → services → db`).
La **lógica de negocio** vive en `src/services/*` y en los `middlewares`, así que
ahí es donde aportan más valor las pruebas unitarias.

El reto principal es que los servicios dependen del pool de MySQL
(`src/db/mysql.js`). Para probarlos de forma **aislada y determinista** (sin una
base de datos real) se inyecta un **doble de prueba (fake)** del pool:

- `tests/helpers/mock-db.js` construye un pool falso con la misma superficie que
  usan los servicios (`execute`, `getConnection`, y una conexión con
  `beginTransaction` / `commit` / `rollback` / `release`).
- Se instala en la caché de módulos de Node (`require.cache`) **antes** de
  requerir el servicio, de modo que cada `require('../db/mysql')` recibe el fake.
- Cada consulta se resuelve con un *handler* configurable (`pool.setHandler`) que
  puede enrutar por el texto del SQL (`router([...])`), y todas las llamadas
  quedan registradas en `pool.calls` para hacer aserciones sobre qué se ejecutó
  y con qué parámetros.

> Node ejecuta cada archivo `*.test.js` en su propio proceso, por lo que la
> inyección del fake en `require.cache` queda aislada por archivo.

De esta forma las pruebas validan la **lógica real** (validaciones, permisos,
reglas de stock, normalización de datos, manejo de transacciones) sin tocar
disco ni red.

## Cobertura

| Archivo de prueba | Módulo bajo prueba | Qué se verifica |
|---|---|---|
| `async-handler.test.js` | `utils/async-handler` | Ejecuta el handler, propaga el resultado y captura promesas rechazadas hacia `next(err)`. |
| `auth.middleware.test.js` | `middlewares/auth.middleware` | `requireSession` (401 sin sesión, normaliza `role`), `requireRoles` (401/403/permitido), `requirePasswordChanged` (rutas de la lista blanca vs. bloqueo 403). |
| `error.middleware.test.js` | `middlewares/error.middleware` | `notFoundHandler` genera un error 404; `errorHandler` respeta `status`/`message` y aplica 500 genérico por defecto. |
| `config.service.test.js` | `services/config.service` | `getAdjustmentMode` (default inactivo, mapeo legado `on`/`off`, estados nuevos); `setAdjustmentMode` (estado inválido, ruta INSERT vs. UPDATE). |
| `report.service.test.js` | `services/report.service` | `getReport` normaliza el periodo (inválido → `weekly`/7 días, `monthly` → 30 días) y devuelve las secciones esperadas. |
| `user.service.test.js` | `services/user.service` | `login` (credenciales faltantes/ inválidas, usuario inactivo, contraseña incorrecta, éxito sin exponer el hash), `createUser` (campos/rol, reglas del primer usuario y jerarquía de permisos), `cambiarPassword` (longitud mínima, hash guardado), `deactivateUser` (no auto-desactivación). |
| `order.service.test.js` | `services/order.service` | Validación del payload (tipo, operador, detalles, cantidad), reglas de negocio (operador inexistente, stock insuficiente, rollback + release), `confirmOrder` (id_usuario requerido, solo órdenes pendientes), `cancelOrder` (400 si no hay pendiente). |
| `inventory.service.test.js` | `services/inventory.service` | `createInventoryItem` (descripción requerida, alta de operador queda pendiente/inactiva, alta de admin queda aprobada/activa, stock inicial 0), `updateInventoryItem` (no ejecuta UPDATE sin campos), `deleteInventoryItem` (baja lógica), `uploadInventoryImage` (validación de tipo MIME y de imagen faltante). |

### Reglas de negocio destacadas cubiertas

- **Seguridad / permisos:** jerarquía de roles (`admin` > `encargado` > `operador`)
  al crear y administrar usuarios; el primer usuario del sistema debe ser
  administrador general; un usuario no puede desactivarse a sí mismo.
- **Autenticación:** `login` rechaza usuarios inactivos y credenciales inválidas,
  y nunca expone `password_hash` en la respuesta.
- **Integridad de inventario:** el stock inicial siempre es `0`; las altas hechas
  por operadores quedan pendientes de aprobación; las bajas son lógicas
  (`activo = 0`).
- **Órdenes / stock:** no se permiten salidas con stock insuficiente y los errores
  hacen `rollback` de la transacción liberando la conexión.
- **Configuración:** compatibilidad con los valores legados `on`/`off` del modo
  de ajuste.

## Resultado actual

```
tests 74
pass  74
fail  0
```

## Cómo agregar una prueba

1. Crear `tests/mi-modulo.test.js`.
2. Si el módulo usa la base de datos, al inicio del archivo:

   ```js
   const { createFakePool, installMockPool, router } = require('./helpers/mock-db');
   const pool = createFakePool();
   installMockPool(pool);              // ANTES de requerir el servicio
   const service = require('../src/services/mi.service');
   ```

3. Configurar las respuestas del SQL con `pool.setHandler(router([...]))` y usar
   `pool.calls` para verificar las consultas ejecutadas.
4. Usar `node:test` (`test`, `t.test`) y `node:assert/strict`.

## Limitaciones conocidas

- Son pruebas **unitarias**: sustituyen la base de datos por un doble, por lo que
  no validan el esquema SQL real ni el comportamiento del motor MySQL
  (transacciones, `FOR UPDATE`, constraints). Para eso haría falta una capa de
  pruebas de integración contra una base de datos de prueba.
- No cubren la capa HTTP (`routes`/`controllers`) ni la generación de PDF
  (`pdf.service`, que depende de Puppeteer). Son candidatos naturales para una
  futura suite de integración con `supertest`.
