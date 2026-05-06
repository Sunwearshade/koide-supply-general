const express = require('express');
const movementController = require('../controllers/movement.controller');
const { requireSession, requireRoles } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', requireRoles(['admin', 'encargado']), asyncHandler(movementController.listMovements));
router.get('/mensajes', requireRoles(['admin', 'encargado']), asyncHandler(movementController.listSystemMessages));
router.get('/:id/documento', requireRoles(['admin', 'encargado']), asyncHandler(movementController.getMovementDocument));
router.post('/:id/revertir', asyncHandler(movementController.revertMovement));

module.exports = router;
