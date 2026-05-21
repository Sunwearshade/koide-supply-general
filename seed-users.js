/**
 * seed-users.js
 * ─────────────────────────────────────────────────────────────────
 * 1. Elimina todos los usuarios con rol 'encargado' u 'operador'
 *    (deja intactos los admins)
 * 2. Inserta los tres nuevos operadores con contraseña Topo4477
 *    y debe_cambiar_password = 1
 *
 * Uso:  node seed-users.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./src/db/mysql');

const DEFAULT_PASSWORD = 'Topo4477';
const DEFAULT_ROLE     = 'operador';

const NEW_USERS = [
  { nombre: 'César Alejandro Luevano', username: 'cesar.luevano' },
  { nombre: 'Armando Kastro',          username: 'armando.kastro'  },
  { nombre: 'César Lujan',             username: 'cesar.lujan'     },
];

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Ver qué usuarios se eliminarán ──────────────────────
    const [existing] = await conn.execute(
      `SELECT id_usuario, nombre, username, rol
       FROM usuarios
       WHERE rol IN ('encargado', 'operador')
       ORDER BY nombre`
    );

    if (existing.length === 0) {
      console.log('No hay usuarios con rol encargado/operador. Se procede solo con el alta.');
    } else {
      console.log('\n── Usuarios que se van a ELIMINAR ──');
      existing.forEach(u =>
        console.log(`  [${u.id_usuario}] ${u.nombre} (${u.username}) — ${u.rol}`)
      );
    }

    // ── 2. Eliminar usuarios de almacén ────────────────────────
    // Nota: si hay FK que los referencian (movimientos, ordenes, etc.)
    // la BD puede rechazar el DELETE. En ese caso se hace deactivate.
    let deleted = 0;
    for (const u of existing) {
      try {
        const [res] = await conn.execute(
          `DELETE FROM usuarios WHERE id_usuario = ?`,
          [u.id_usuario]
        );
        if (res.affectedRows > 0) deleted++;
      } catch (err) {
        // FK constraint: no se puede borrar, se desactiva en su lugar
        console.warn(`  ⚠ No se pudo eliminar [${u.id_usuario}] ${u.nombre} (tiene registros relacionados). Se desactiva.`);
        await conn.execute(
          `UPDATE usuarios SET activo = 0 WHERE id_usuario = ?`,
          [u.id_usuario]
        );
      }
    }
    console.log(`\n  ${deleted} usuario(s) eliminado(s), ${existing.length - deleted} desactivado(s) por referencias existentes.`);

    // ── 3. Insertar nuevos usuarios ────────────────────────────
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    console.log('\n── Usuarios que se van a CREAR ──');
    for (const u of NEW_USERS) {
      const [res] = await conn.execute(
        `INSERT INTO usuarios (nombre, username, password_hash, rol, activo, debe_cambiar_password)
         VALUES (?, ?, ?, ?, 1, 1)`,
        [u.nombre, u.username, passwordHash, DEFAULT_ROLE]
      );
      console.log(`  ✔ [${res.insertId}] ${u.nombre} — usuario: "${u.username}" — pass: "${DEFAULT_PASSWORD}" — rol: ${DEFAULT_ROLE}`);
    }

    await conn.commit();
    console.log('\n✅ Operación completada exitosamente.\n');
  } catch (err) {
    await conn.rollback();
    console.error('\n❌ Error — se revirtió la transacción:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
