const express = require('express');
const inventoryController = require('../controllers/inventory.controller');
const { requireSession, requireRoles } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', asyncHandler(inventoryController.listInventory));
router.get('/pendientes', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.listPendingInventory));
router.get('/:id', asyncHandler(inventoryController.getInventoryItem));
router.post('/', requireRoles(['admin', 'encargado', 'operador']), asyncHandler(inventoryController.createInventoryItem));
router.post('/:id/aprobar', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.approveInventoryItem));
router.post('/:id/rechazar', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.rejectInventoryItem));
router.put('/:id', requireRoles(['admin']), asyncHandler(inventoryController.updateInventoryItem));
router.delete('/:id', requireRoles(['admin']), asyncHandler(inventoryController.deleteInventoryItem));

module.exports = router;
