# Plan de Proyecto — Koide Supply
### Sistema de Gestión de Almacén / Inventario de Refacciones

> **Nota de enfoque:** Este documento se redacta como si el sistema **no existiera todavía**.
> Es la planificación, el análisis y el diseño "desde cero". El proyecto se divide **por roles de usuario**:
> cada sprint toma **todos los requisitos de un rol** y ejecuta sobre él el ciclo completo
> (análisis → diseño → diseño de componentes → codificación → pruebas → entrega).
> **Duración total: 18 semanas.**

---

## 1. Visión general del sistema

Koide Supply es una aplicación web para administrar el inventario de un almacén de refacciones.
Permite registrar refacciones, controlar entradas y salidas mediante **órdenes**, generar
**movimientos** trazables de stock, producir documentos/vales en PDF y mantener un control
de inventario con aprobaciones.

**Stack tecnológico:**
- **Backend:** Node.js + Express
- **Base de datos:** MySQL (mysql2)
- **Autenticación:** sesiones (express-session) + hash de contraseñas (bcryptjs)
- **Generación de documentos:** Puppeteer (PDF de vales/órdenes)
- **Frontend:** HTML + CSS + JavaScript (SPA ligera en `public/`)

**Arquitectura por capas (backend):**
```
Rutas (routes)  →  Controladores (controllers)  →  Servicios (services)  →  Base de datos (MySQL)
        ▲
   Middlewares (sesión, roles, cambio de contraseña, errores)
```

---

## 2. Los tres roles del sistema (¿Qué hace cada persona?)

El sistema define exactamente **tres roles** (`enum('admin','encargado','operador')` en la tabla `usuarios`).
La autorización se resuelve con el middleware `requireRoles([...])`. El siguiente cuadro es la base
para dividir el proyecto en sprints.

### 2.1 OPERADOR (perfil de menor privilegio — operación diaria)

Es la persona que **trabaja en piso**: consulta refacciones y registra el movimiento que necesita.
No aprueba ni ejecuta cambios de fondo; **todo lo que crea queda "pendiente"** de validación.

**Qué puede hacer:**
- Iniciar sesión y **cambiar su contraseña** (obligatorio en el primer ingreso, `debe_cambiar_password = 1`).
- **Consultar el inventario** (lista y detalle de refacciones).
- **Dar de alta una refacción nueva** → queda en estado `pendiente` de aprobación (no entra activa al stock).
- **Subir una imagen** a una refacción.
- **Crear órdenes** de entrada o salida → quedan en estado `pendiente`.
- **Consultar órdenes** y **descargar su PDF / vale**.
- Ver el **reporte básico** de inventario.

**Qué NO puede hacer:**
- Confirmar, cancelar o revertir órdenes.
- Aprobar/rechazar altas de refacciones.
- Ver movimientos, mensajes del sistema ni estadísticas.
- Editar (`PUT`) o eliminar (`DELETE`) refacciones.
- Gestionar usuarios.

---

### 2.2 ENCARGADO (supervisor de almacén — privilegio intermedio)

Es quien **opera y valida el flujo diario** del almacén. Hace todo lo del operador y, además,
ejecuta las órdenes (las confirma), revierte movimientos, gestiona usuarios y prepara los
ajustes de inventario para que el administrador los apruebe.

**Qué puede hacer (además de todo lo del operador):**
- **Confirmar / cancelar / revertir órdenes** (esto genera o anula movimientos de stock).
- **Ver movimientos, mensajes del sistema y documentos** asociados; **revertir un movimiento**.
- Ver el **inventario pendiente** y los **reportes con estadísticas**.
- **Eliminar la imagen** de una refacción.
- **Modo de ajuste de inventario:**
  - Guardar **borrador** de ajustes (cambios masivos de existencias/mínimos/máximos).
  - Registrar **ítems nuevos** dentro del ajuste y subir/eliminar sus imágenes.
  - **Enviar el ajuste a revisión** (cambiar el modo a "revisión").
- **Gestión de usuarios:** listar, editar, activar y desactivar.

**Qué NO puede hacer (reservado al admin):**
- **Aprobar/rechazar** altas de refacciones.
- **Aprobar/rechazar** el borrador de ajuste de inventario.
- **Editar (`PUT`) o eliminar (`DELETE`)** una refacción directamente.
- Cambiar el modo de ajuste a **cualquier** estado (el encargado solo puede enviar a revisión).

---

### 2.3 ADMIN (administrador — control total)

Es la autoridad final. Hace todo lo del encargado y, además, **aprueba o rechaza** lo que los
demás proponen y tiene **control directo** sobre el inventario.

**Qué puede hacer (además de todo lo del encargado):**
- **Aprobar / rechazar altas** de refacciones (las pendientes pasan a `aprobado` o `rechazado`).
- **Aprobar / rechazar** el borrador de ajuste de inventario (aplica los cambios al stock real).
- **Editar (`PUT`) y eliminar (`DELETE`)** refacciones directamente.
- **Cambiar el modo de ajuste a cualquier estado** (off / edición / revisión).
- Control total del sistema y de la configuración.

---

### 2.4 Matriz resumen de permisos por rol

| Funcionalidad | Operador | Encargado | Admin |
|---|:---:|:---:|:---:|
| Login / cambiar contraseña | ✅ | ✅ | ✅ |
| Consultar inventario (lista/detalle) | ✅ | ✅ | ✅ |
| Alta de refacción (queda pendiente) | ✅ | ✅ | ✅ |
| Subir imagen a refacción | ✅ | ✅ | ✅ |
| Crear orden (entrada/salida) | ✅ | ✅ | ✅ |
| Ver órdenes / descargar PDF | ✅ | ✅ | ✅ |
| Reporte básico | ✅ | ✅ | ✅ |
| Confirmar / cancelar / revertir orden | ❌ | ✅ | ✅ |
| Ver movimientos / mensajes / documentos | ❌ | ✅ | ✅ |
| Revertir movimiento | ❌ | ✅ | ✅ |
| Reportes con estadísticas | ❌ | ✅ | ✅ |
| Ver inventario pendiente | ❌ | ✅ | ✅ |
| Eliminar imagen de refacción | ❌ | ✅ | ✅ |
| Modo ajuste: borrador / ítems nuevos / enviar a revisión | ❌ | ✅ | ✅ |
| Gestión de usuarios (listar/editar/activar/desactivar) | ❌ | ✅ | ✅ |
| Aprobar / rechazar alta de refacción | ❌ | ❌ | ✅ |
| Aprobar / rechazar ajuste de inventario | ❌ | ❌ | ✅ |
| Editar (PUT) / eliminar (DELETE) refacción | ❌ | ❌ | ✅ |
| Cambiar modo de ajuste a cualquier estado | ❌ | ❌ | ✅ |

> **Observación clave de diseño:** los permisos son **acumulativos** (Operador ⊂ Encargado ⊂ Admin).
> Esto justifica el orden de los sprints: construimos primero la base que comparten todos, luego el
> rol más simple, y vamos añadiendo capacidades hacia el rol más completo.

---

## 3. Modelo de datos (diseño de base de datos)

Tablas principales (de `db/schema.sql`):

| Tabla | Propósito | Rol que la "dispara" |
|---|---|---|
| `usuarios` | Cuentas, rol y bandera `debe_cambiar_password` | Base / Admin-Encargado |
| `inventario` | Refacciones, stock y `estado_revision` (pendiente/aprobado/rechazado) | Operador (alta) / Admin (aprueba) |
| `ordenes` | Cabecera de orden (entrada/salida, estado) | Operador (crea) / Encargado (confirma) |
| `orden_detalle` | Renglones de cada orden (refacción + cantidad) | Operador |
| `movimientos` | Movimientos de stock confirmados/revertidos | Encargado |
| `mensajes_sistema` | Bitácora/avisos del sistema | Encargado/Admin |
| `documentos_movimiento` | Documentos JSON (permisos/reversiones) | Encargado/Admin |
| `configuracion_sistema` | Config global (ej. `modo_ajuste_inventario`) | Admin |
| `log_ajuste_inventario` | Auditoría de cambios de ajuste | Encargado/Admin |
| `ajuste_inventario_borrador` | Borrador de ajuste masivo | Encargado |
| `ajuste_inventario_nuevos` | Ítems nuevos propuestos en un ajuste | Encargado |

---

## 4. Estrategia de sprints (división por rol)

El proyecto se divide en **5 sprints secuenciales**. El Sprint 0 construye la base común
(necesaria para que cualquier rol funcione); los Sprints 1, 2 y 3 toman **un rol completo
cada uno**; el Sprint 4 cierra, integra y entrega.

| Sprint | Foco (rol) | Semanas | Duración |
|---|---|---|---|
| **Sprint 0** | Fundamentos / Arquitectura base (transversal) | 1 – 3 | 3 semanas |
| **Sprint 1** | Rol **OPERADOR** | 4 – 7 | 4 semanas |
| **Sprint 2** | Rol **ENCARGADO** | 8 – 12 | 5 semanas |
| **Sprint 3** | Rol **ADMIN** | 13 – 16 | 4 semanas |
| **Sprint 4** | Cierre, integración y entrega final | 17 – 18 | 2 semanas |
| | **TOTAL** | | **18 semanas** |

Cada sprint (excepto el 0 y el 4) recorre **el mismo ciclo de fases** que pidió el alcance:
**Análisis → Diseño → Diseño de componentes de software → Codificación → Pruebas → Entrega.**

---

## 5. Detalle de cada sprint (secuencia de trabajo)

### 🟦 SPRINT 0 — Fundamentos / Arquitectura base (Semanas 1–3)

**Por qué primero:** todos los roles dependen de autenticación, base de datos y la estructura por capas.
Sin esto ningún rol puede probarse.

**Secuencia:**

1. **Semana 1 — Análisis y diseño general**
   - Levantamiento de requisitos globales y de los 3 roles.
   - Diseño del **modelo de datos** (`schema.sql`) y diagrama entidad-relación.
   - Definición de la **arquitectura por capas** (rutas/controladores/servicios).
2. **Semana 2 — Diseño de componentes transversales y codificación base**
   - Componente de **conexión a BD** (`src/db/mysql.js`).
   - **Middlewares**: `requireSession`, `requireRoles`, `requirePasswordChanged`, manejo de errores.
   - **Servicio de usuarios** (login, hash bcrypt, sesión) y `seed-users.js`.
3. **Semana 3 — Codificación de autenticación + pruebas + entrega**
   - Login, logout, `/me`, **cambio de contraseña obligatorio** en primer ingreso.
   - Pruebas de seguridad de acceso (sesión requerida, roles).
   - **Entrega 0:** entorno desplegable, BD creada, login funcional para los 3 roles.

**Componentes de software entregados:** `db/schema.sql`, `src/db/mysql.js`,
`src/middlewares/*`, `src/services/user.service.js`, `src/controllers/user.controller.js` (login/me/logout/cambiar-password).

---

### 🟩 SPRINT 1 — Rol OPERADOR (Semanas 4–7)

**Requisitos del rol:** consultar inventario, alta de refacción (pendiente), subir imagen,
crear órdenes, ver órdenes y descargar PDF, ver reporte básico.

**Secuencia:**

1. **Semana 4 — Análisis del rol Operador**
   - Casos de uso: *Consultar inventario*, *Solicitar alta de refacción*, *Registrar orden*.
   - Reglas de negocio: una refacción nueva inicia en stock `0` y `estado_revision = pendiente`;
     las órdenes nacen en estado `pendiente`.
2. **Semana 5 — Diseño y diseño de componentes**
   - Diseño de pantallas del operador (consulta, alta, creación de orden).
   - **Diseño de componentes:**
     - `inventory.service` (lectura + alta pendiente) y `inventory.controller`.
     - `order.service` (crear orden + detalle) y `order.controller`.
     - `report.service` (reporte básico).
3. **Semana 6 — Codificación**
   - Endpoints: `GET /inventario`, `GET /inventario/:id`, `POST /inventario`,
     `POST /inventario/:id/imagen`, `POST /ordenes`, `GET /ordenes`, `GET /ordenes/:id`,
     `GET /ordenes/:id/pdf`, `GET /reportes`.
   - Generación de PDF/vale (`pdf.service`, `templates/vale.html`).
   - Frontend de las vistas del operador.
4. **Semana 7 — Pruebas y entrega**
   - Pruebas funcionales y de permisos (que el operador **no** acceda a lo restringido).
   - **Entrega 1:** un operador puede consultar, dar de alta (pendiente), crear órdenes y descargar PDF.

**Componentes de software entregados:** `inventory.service.js`, `inventory.controller.js`,
`order.service.js`, `order.controller.js`, `report.service.js`, `pdf.service.js`,
rutas correspondientes y vistas frontend del operador.

---

### 🟨 SPRINT 2 — Rol ENCARGADO (Semanas 8–12)

**Requisitos del rol:** confirmar/cancelar/revertir órdenes, movimientos y mensajes,
revertir movimiento, estadísticas, inventario pendiente, eliminar imagen, modo de ajuste
(borrador/ítems nuevos/enviar a revisión), gestión de usuarios.

Es el sprint más largo (5 semanas) porque concentra la **lógica de negocio crítica**
(generación de movimientos de stock) y varios subsistemas.

**Secuencia:**

1. **Semana 8 — Análisis del rol Encargado**
   - Casos de uso: *Confirmar orden → generar movimiento*, *Revertir movimiento*,
     *Preparar ajuste de inventario*, *Administrar usuarios*.
   - Reglas: confirmar una orden genera movimientos que afectan `existencias`;
     toda reversión queda trazada (`es_reversion`, `id_movimiento_origen`).
2. **Semana 9 — Diseño y diseño de componentes (órdenes y movimientos)**
   - **Componentes:** `movement.service` / `movement.controller`,
     extensión de `order.service` (confirmar/cancelar/revertir),
     `system-message.service`, `documentos_movimiento`.
3. **Semana 10 — Codificación de órdenes/movimientos**
   - `POST /ordenes/:id/confirmar | cancelar | revertir`.
   - `GET /movimientos`, `GET /movimientos/mensajes`, `GET /movimientos/:id/documento`,
     `POST /movimientos/:id/revertir`.
   - `GET /reportes/estadisticas`, `GET /inventario/pendientes`.
4. **Semana 11 — Codificación de ajuste de inventario y usuarios**
   - Modo ajuste: `GET/PUT /inventario/ajuste/modo` (encargado: solo enviar a revisión),
     `POST/GET /inventario/ajuste/borrador`, `POST/GET /inventario/ajuste/nuevos`,
     imágenes de ítems nuevos, `GET /inventario/ajuste/logs`.
   - Gestión de usuarios: `GET /usuarios`, `PUT /usuarios/:id`,
     `DELETE /usuarios/:id`, `PATCH /usuarios/:id/activar`.
   - `DELETE /inventario/:id/imagen`.
5. **Semana 12 — Pruebas y entrega**
   - Pruebas de integración del flujo orden → confirmación → movimiento → reversión.
   - Pruebas de que el encargado **no** aprueba ni edita/elimina refacciones.
   - **Entrega 2:** flujo completo de almacén operativo bajo el encargado.

**Componentes de software entregados:** `movement.service.js`, `movement.controller.js`,
`system-message.service.js`, `config.service.js`, ampliación de `order.service.js` e
`inventory.service.js` (borrador/nuevos/logs), `user.controller.js`/`user.service.js`
(CRUD de usuarios), rutas de movimientos y vistas del encargado.

---

### 🟥 SPRINT 3 — Rol ADMIN (Semanas 13–16)

**Requisitos del rol:** aprobar/rechazar altas, aprobar/rechazar ajuste de inventario,
editar y eliminar refacciones, cambiar el modo de ajuste a cualquier estado.

**Secuencia:**

1. **Semana 13 — Análisis del rol Admin**
   - Casos de uso: *Aprobar alta de refacción*, *Aprobar ajuste de inventario*,
     *Editar/eliminar refacción*, *Controlar el modo de ajuste*.
   - Reglas: aprobar un ajuste **aplica los cambios al stock real**; aprobar un alta
     pasa la refacción de `pendiente` a `aprobado` y la activa.
2. **Semana 14 — Diseño y diseño de componentes**
   - Extensión de `inventory.service` con aprobación/rechazo y edición directa.
   - Lógica de aplicación del borrador de ajuste sobre `inventario` + registro en `log_ajuste_inventario`.
3. **Semana 15 — Codificación**
   - `POST /inventario/:id/aprobar | rechazar`, `PUT /inventario/:id`, `DELETE /inventario/:id`.
   - `POST /inventario/ajuste/aprobar | rechazar`, `PUT /inventario/ajuste/modo` (cualquier estado).
   - Panel de administración (frontend) para revisar pendientes y ajustes.
4. **Semana 16 — Pruebas y entrega**
   - Pruebas del ciclo completo: operador propone → encargado prepara → **admin aprueba**.
   - Pruebas de control de acceso final (solo admin en estos endpoints).
   - **Entrega 3:** sistema con autorización completa de los 3 roles.

**Componentes de software entregados:** ampliación final de `inventory.service.js` /
`inventory.controller.js` (aprobar/rechazar/editar/eliminar y aprobación de ajustes),
`config.service.js` (control de modo), panel de administración en frontend.

---

### ⬛ SPRINT 4 — Cierre, integración y entrega final (Semanas 17–18)

1. **Semana 17 — Integración y pruebas de sistema**
   - Pruebas end-to-end con los 3 roles interactuando.
   - Corrección de defectos, pruebas de seguridad y de regresión.
   - Limpieza para producción (`clean-for-production.js`, `reset-for-hosting.js`).
2. **Semana 18 — Documentación y entrega**
   - Manual de usuario por rol, manual técnico, despliegue (hosting + BD).
   - Capacitación y **entrega final** del proyecto.

---

## 6. Resumen del cronograma (vista de secuencia, 18 semanas)

```
Sem:  1   2   3 | 4   5   6   7 | 8   9  10  11  12 | 13  14  15  16 | 17  18
     [  SPRINT 0 ][   SPRINT 1   ][      SPRINT 2     ][   SPRINT 3   ][SPRINT 4]
      Base común     OPERADOR          ENCARGADO            ADMIN        Cierre
     Auth/BD/capas  Consulta+altas   Órdenes/mov./       Aprobaciones   Integr.
                    +órdenes+PDF     ajustes/usuarios    +CRUD directo   +entrega
```

**Ciclo de fases que se repite en cada sprint de rol (1, 2 y 3):**
`Análisis → Diseño → Diseño de componentes de software → Codificación → Pruebas → Entrega`

---

## 7. Entregables por sprint

| Sprint | Entregable principal |
|---|---|
| 0 | Entorno + BD + autenticación y control de roles funcionando |
| 1 | Funcionalidad completa del **Operador** (consulta, altas pendientes, órdenes, PDF) |
| 2 | Funcionalidad completa del **Encargado** (órdenes, movimientos, ajustes, usuarios) |
| 3 | Funcionalidad completa del **Admin** (aprobaciones y CRUD directo de inventario) |
| 4 | Sistema integrado, documentado y desplegado |
