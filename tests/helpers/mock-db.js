'use strict';

// Helper para pruebas unitarias: reemplaza el pool real de MySQL (src/db/mysql.js)
// por un doble de prueba (fake) inyectado en la cache de modulos de Node.
//
// De esta forma los servicios se pueden probar SIN una base de datos real:
// cada servicio hace `require('../db/mysql')` y recibe este fake en su lugar.
//
// El fake registra todas las llamadas (pool.calls) y delega la respuesta de
// cada consulta en un "handler" configurable con pool.setHandler(fn).

const path = require('path');

const POOL_PATH = require.resolve(
  path.join(__dirname, '..', '..', 'src', 'db', 'mysql.js')
);

// Crea un pool falso con la misma superficie que se usa en los servicios:
//   pool.execute(sql, params)        -> [rows, fields]
//   pool.getConnection()             -> connection con transacciones
//   connection.execute / .query / .beginTransaction / .commit / .rollback / .release
//
// El handler recibe (sql, params) y devuelve `rows` (array) o [rows, fields].
// Por defecto devuelve [] (conjunto vacio).
function createFakePool() {
  const calls = [];
  let handler = () => [];

  function normalize(result) {
    // Permite que el handler devuelva rows directamente o [rows, fields].
    if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0])) {
      return result;
    }
    return [result || [], []];
  }

  async function execute(sql, params) {
    calls.push({ type: 'execute', sql, params });
    return normalize(handler(sql, params));
  }

  async function query(sql, params) {
    calls.push({ type: 'query', sql, params });
    return normalize(handler(sql, params));
  }

  const connection = {
    async beginTransaction() {
      calls.push({ type: 'beginTransaction' });
    },
    async commit() {
      calls.push({ type: 'commit' });
    },
    async rollback() {
      calls.push({ type: 'rollback' });
    },
    release() {
      calls.push({ type: 'release' });
    },
    execute,
    query
  };

  return {
    calls,
    setHandler(fn) {
      handler = fn;
    },
    execute,
    query,
    async getConnection() {
      calls.push({ type: 'getConnection' });
      return connection;
    }
  };
}

// Inyecta el pool falso en la cache de modulos, de modo que cualquier
// `require('../db/mysql')` posterior devuelva `pool`.
function installMockPool(pool) {
  require.cache[POOL_PATH] = {
    id: POOL_PATH,
    filename: POOL_PATH,
    loaded: true,
    exports: pool
  };
}

function restoreMockPool() {
  delete require.cache[POOL_PATH];
}

// Utilidad: enruta una consulta segun el primer patron que coincida.
// routes: array de [regexp | substring, respuesta | fn(sql, params)]
function router(routes, fallback = []) {
  return (sql, params) => {
    for (const [matcher, response] of routes) {
      const matches =
        matcher instanceof RegExp ? matcher.test(sql) : sql.includes(matcher);
      if (matches) {
        return typeof response === 'function' ? response(sql, params) : response;
      }
    }
    return typeof fallback === 'function' ? fallback(sql, params) : fallback;
  };
}

module.exports = {
  POOL_PATH,
  createFakePool,
  installMockPool,
  restoreMockPool,
  router
};
