/**
 * clean-for-production.js
 * ─────────────────────────────────────────────────────────────────
 * Prepara la BD para producción:
 *
 * LIMPIA (trunca/elimina registros):
 *   documentos_movimiento, mensajes_sistema, movimientos,
 *   orden_detalle, ordenes, log_ajuste_inventario,
 *   ajuste_inventario_borrador, ajuste_inventario_nuevos
 *   configuracion_sistema → reset modo_ajuste a 'off'
 *
 * USUARIOS — solo conserva / crea:
 *   ✔  admin (rol admin, el que ya existe)
 *   ✔  cesar.luevano, armando.kastro, cesar.lujan  (recién creados)
 *   ✔  sarahi (koide2) — se reactiva y actualiza nombre
 *   ✔  santiban (encargado) — se crea nuevo
 *   ✘  Todos los demás se eliminan (o desactivan si tienen FKs)
 *
 * INVENTARIO — se mantiene intacto
 *
 * Uso:  node clean-for-production.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./src/db/mysql');

const DEFAULT_PASSWORD = 'Topo4477';

// Usernames que se conservan (además del admin)
const KEEP_USERNAMES = new Set([
  'cesar.luevano',
  'armando.kastro',
  'cesar.lujan',
  'koide2',       // sarahi — se reactiva
]);

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('SET foreign_key_checks = 0');

    // ── 1. Limpiar tablas transaccionales ──────────────────────
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

    console.log('\n── Limpiando tablas transaccionales ──');
    for (const table of TRUNCATE_TABLES) {
      await conn.execute(`TRUNCATE TABLE \`${table}\``);
      console.log(`  ✔ ${table} → vacía`);
    }

    // Reset configuración del modo ajuste
    await conn.execute(
      `UPDATE configuracion_sistema SET valor = 'off', updated_by = NULL WHERE clave = 'modo_ajuste_inventario'`
    );
    console.log('  ✔ configuracion_sistema → modo_ajuste_inventario = off');

    // ── 2. Resetear AUTO_INCREMENT de tablas limpias ───────────
    for (const table of TRUNCATE_TABLES) {
      await conn.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    }

    // ── 3. Inventario: limpiar FKs de usuarios que serán borrados ──
    // (id_solicitante_alta / id_aprobador_alta pueden apuntar a usuarios eliminados)
    await conn.execute(
      `UPDATE inventario SET id_solicitante_alta = NULL, id_aprobador_alta = NULL, fecha_revision = NULL`
    );
    console.log('\n  ✔ inventario → referencias de usuarios limpiadas (datos de producto intactos)');

    // ── 4. Obtener todos los usuarios ──────────────────────────
    const [allUsers] = await conn.execute(
      `SELECT id_usuario, nombre, username, rol FROM usuarios ORDER BY id_usuario`
    );

    // ── 5. Crear / reactivar usuario santiban ──────────────────
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Verificar si santiban ya existe
    const [sbRows] = await conn.execute(
      `SELECT id_usuario FROM usuarios WHERE username = 'santiban' LIMIT 1`
    );
    if (sbRows.length === 0) {
      const [res] = await conn.execute(
        `INSERT INTO usuarios (nombre, username, password_hash, rol, activo, debe_cambiar_password)
         VALUES ('Sarahi Santibanez', 'santiban', ?, 'encargado', 1, 1)`,
        [passwordHash]
      );
      console.log(`\n  ✔ Usuario creado: [${res.insertId}] Sarahi Santibanez — usuario: "santiban" — rol: encargado`);
    } else {
      await conn.execute(
        `UPDATE usuarios SET activo = 1, rol = 'encargado', debe_cambiar_password = 1 WHERE username = 'santiban'`
      );
      console.log('\n  ✔ Usuario santiban ya existía → reactivado como encargado');
    }

    // Reactivar sarahi (koide2) y actualizar nombre
    await conn.execute(
      `UPDATE usuarios
       SET activo = 1, nombre = 'Sarahi Santibanez', debe_cambiar_password = 1,
           password_hash = ?
       WHERE username = 'koide2'`,
      [passwordHash]
    );
    console.log('  ✔ sarahi (koide2) → reactivada, nombre actualizado, pass reseteado a Topo4477');

    // ── 6. Recargar lista de usuarios y depurar los que no se conservan ──
    KEEP_USERNAMES.add('santiban'); // añadir el recién creado/reactivado

    const [freshUsers] = await conn.execute(
      `SELECT id_usuario, nombre, username, rol FROM usuarios ORDER BY id_usuario`
    );

    console.log('\n── Depurando usuarios sobrantes ──');
    let deleted = 0, deactivated = 0;
    for (const u of freshUsers) {
      if (u.rol === 'admin') continue;              // nunca tocar admins
      if (KEEP_USERNAMES.has(u.username)) continue; // conservar lista blanca

      try {
        await conn.execute(`DELETE FROM usuarios WHERE id_usuario = ?`, [u.id_usuario]);
        console.log(`  ✔ Eliminado: [${u.id_usuario}] ${u.nombre} (${u.username})`);
        deleted++;
      } catch {
        await conn.execute(`UPDATE usuarios SET activo = 0 WHERE id_usuario = ?`, [u.id_usuario]);
        console.log(`  ⚠ Desactivado (FKs): [${u.id_usuario}] ${u.nombre} (${u.username})`);
        deactivated++;
      }
    }
    console.log(`  → ${deleted} eliminado(s), ${deactivated} desactivado(s)`);

    await conn.execute('SET foreign_key_checks = 1');
    await conn.commit();

    // ── 7. Resumen final ───────────────────────────────────────
    const [finalUsers] = await conn.execute(
      `SELECT id_usuario, nombre, username, rol, activo FROM usuarios ORDER BY rol, nombre`
    );
    console.log('\n── Estado final de usuarios ──');
    finalUsers.forEach(u =>
      console.log(`  [${u.id_usuario}] ${u.nombre.padEnd(30)} ${u.username.padEnd(20)} ${u.rol.padEnd(10)} ${u.activo ? '🟢 activo' : '🔴 inactivo'}`)
    );

    console.log('\n✅ Base de datos lista para producción.\n');
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
