/**
 * reset-for-hosting.js
 * ─────────────────────────────────────────────────────────────────
 * Limpieza final antes de hostear:
 *
 *  LIMPIA: ordenes, orden_detalle, movimientos, mensajes_sistema,
 *          documentos_movimiento, log_ajuste_inventario,
 *          ajuste_inventario_borrador, ajuste_inventario_nuevos
 *          configuracion_sistema → reset a 'off'
 *
 *  USUARIOS: elimina TODOS excepto jonathan (admin existente)
 *            crea los 5 usuarios nuevos:
 *            • César Alejandro Luevano   — operador
 *            • Armando Kastro            — operador
 *            • César Lujan              — operador
 *            • Sarahi Santibanez         — encargado
 *            • Carlos Mantenimiento      — admin
 *
 *  INVENTARIO: intacto
 *
 * Uso: node reset-for-hosting.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./src/db/mysql');

const DEFAULT_PASSWORD = 'Topo4477';
const KEEP_USERNAME    = 'jonathan'; // único que se conserva

const NEW_USERS = [
  { nombre: 'César Alejandro Luevano', username: 'cesar.luevano',  rol: 'operador'  },
  { nombre: 'Armando Kastro',          username: 'armando.kastro', rol: 'operador'  },
  { nombre: 'César Lujan',             username: 'cesar.lujan',    rol: 'operador'  },
  { nombre: 'Sarahi Santibanez',       username: 'santiban',       rol: 'encargado' },
  { nombre: 'Carlos Mantenimiento',    username: 'carlos.mant',    rol: 'admin'     },
];

const TRUNCATE_TABLES = [
  'documentos_movimiento',
  'mensajes_sistema',
  'movimientos',
  'orden_detalle',
  'ordenes',
  'log_ajuste_inventario',
  'ajuste_inventario_borrador',
  'ajuste_inventario_nuevos',
];

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('SET foreign_key_checks = 0');

    // ── 1. Vaciar tablas transaccionales ───────────────────────
    console.log('\n── Limpiando tablas transaccionales ──');
    for (const table of TRUNCATE_TABLES) {
      await conn.execute(`TRUNCATE TABLE \`${table}\``);
      console.log(`  ✔ ${table}`);
    }

    // Reset AUTO_INCREMENT
    for (const table of TRUNCATE_TABLES) {
      await conn.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    }

    // Reset modo ajuste
    await conn.execute(
      `UPDATE configuracion_sistema SET valor = 'off', updated_by = NULL
       WHERE clave = 'modo_ajuste_inventario'`
    );
    console.log('  ✔ configuracion_sistema → modo_ajuste = off');

    // Limpiar FKs de usuarios en inventario (id_solicitante_alta / id_aprobador_alta)
    await conn.execute(
      `UPDATE inventario SET id_solicitante_alta = NULL, id_aprobador_alta = NULL, fecha_revision = NULL`
    );
    console.log('  ✔ inventario → referencias de usuarios limpiadas (productos intactos)');

    // ── 2. Eliminar todos los usuarios menos jonathan ──────────
    const [allUsers] = await conn.execute(
      `SELECT id_usuario, nombre, username, rol FROM usuarios ORDER BY id_usuario`
    );

    console.log('\n── Depurando usuarios ──');
    let deleted = 0;
    for (const u of allUsers) {
      if (u.username === KEEP_USERNAME) {
        console.log(`  → Conservado: [${u.id_usuario}] ${u.nombre} (${u.username})`);
        continue;
      }
      await conn.execute(`DELETE FROM usuarios WHERE id_usuario = ?`, [u.id_usuario]);
      console.log(`  ✔ Eliminado:  [${u.id_usuario}] ${u.nombre} (${u.username})`);
      deleted++;
    }
    console.log(`  → ${deleted} usuario(s) eliminado(s)`);

    // ── 3. Crear nuevos usuarios ───────────────────────────────
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log('\n── Creando usuarios nuevos ──');
    for (const u of NEW_USERS) {
      const [res] = await conn.execute(
        `INSERT INTO usuarios (nombre, username, password_hash, rol, activo, debe_cambiar_password)
         VALUES (?, ?, ?, ?, 1, 1)`,
        [u.nombre, u.username, passwordHash, u.rol]
      );
      console.log(`  ✔ [${res.insertId}] ${u.nombre.padEnd(28)} ${u.username.padEnd(18)} ${u.rol}`);
    }

    await conn.execute('SET foreign_key_checks = 1');
    await conn.commit();

    // ── 4. Estado final ────────────────────────────────────────
    const [finalUsers] = await conn.execute(
      `SELECT id_usuario, nombre, username, rol FROM usuarios ORDER BY rol, nombre`
    );
    console.log('\n── Usuarios activos finales ──');
    finalUsers.forEach(u =>
      console.log(`  [${String(u.id_usuario).padEnd(3)}] ${u.nombre.padEnd(30)} ${u.username.padEnd(20)} ${u.rol}`)
    );
    console.log('\n  Contraseña inicial de todos: Topo4477  (se pedirá cambio en primer login)\n');
    console.log('✅ Sistema listo para hostear.\n');

  } catch (err) {
    await conn.rollback();
    await conn.execute('SET foreign_key_checks = 1').catch(() => {});
    console.error('\n❌ Error — se revirtió todo:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
