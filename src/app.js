const express = require('express');
const session = require('express-session');
const path = require('path');

const inventoryRoutes = require('./routes/inventory.routes');
const movementRoutes = require('./routes/movement.routes');
const orderRoutes = require('./routes/order.routes');
const reportRoutes = require('./routes/report.routes');
const userRoutes = require('./routes/user.routes');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'koide-supply-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'Koide Supply' });
});

app.use('/api/usuarios', userRoutes);
app.use('/api/inventario', inventoryRoutes);
app.use('/api/ordenes', orderRoutes);
app.use('/api/movimientos', movementRoutes);
app.use('/api/reportes', reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
