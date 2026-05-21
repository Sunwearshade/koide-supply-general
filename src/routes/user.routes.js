const express = require('express');
const userController = require('../controllers/user.controller');
const { requireSession, requireRoles, requirePasswordChanged } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.post('/login', asyncHandler(userController.login));
router.get('/me', asyncHandler(userController.me));
router.post('/logout', asyncHandler(userController.logout));
router.post('/', asyncHandler(userController.createUser));

// Ruta especial: requiere sesion pero NO bloquea si debe_cambiar_password
router.post('/cambiar-password', requireSession, asyncHandler(userController.cambiarPassword));

router.use(requireSession);

router.get('/', requireRoles(['admin', 'encargado']), asyncHandler(userController.listUsers));
router.put('/:id', requireRoles(['admin', 'encargado']), asyncHandler(userController.updateUser));
router.delete('/:id', requireRoles(['admin', 'encargado']), asyncHandler(userController.deactivateUser));
router.patch('/:id/activar', requireRoles(['admin', 'encargado']), asyncHandler(userController.activateUser));

module.exports = router;
