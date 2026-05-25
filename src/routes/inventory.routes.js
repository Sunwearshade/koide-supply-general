const express = require('express');
const inventoryController = require('../controllers/inventory.controller');
const { requireSession, requireRoles } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', asyncHandler(inventoryController.listInventory));
router.get('/pendientes', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.listPendingInventory));

// Adjustment mode routes
router.get('/ajuste/modo', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.getAdjustmentMode));
// Admin puede cambiar a cualquier estado; encargado solo puede enviar a revision
router.put('/ajuste/modo', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.setAdjustmentMode));
router.post('/ajuste/borrador', requireRoles(['encargado']), asyncHandler(inventoryController.saveAdjustmentDraft));
router.get('/ajuste/borrador', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.getAdjustmentDraft));
router.post('/ajuste/nuevos', requireRoles(['encargado']), asyncHandler(inventoryController.saveAdjustmentNewItems));
router.get('/ajuste/nuevos', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.getAdjustmentNewItems));
router.post('/ajuste/nuevos/:id/imagen', requireRoles(['encargado']), asyncHandler(inventoryController.uploadAdjustmentNewItemImage));
router.delete('/ajuste/nuevos/:id/imagen', requireRoles(['encargado']), asyncHandler(inventoryController.deleteAdjustmentNewItemImage));
router.post('/ajuste/aprobar', requireRoles(['admin']), asyncHandler(inventoryController.approveAdjustmentDraft));
router.post('/ajuste/rechazar', requireRoles(['admin']), asyncHandler(inventoryController.rejectAdjustmentDraft));
router.get('/ajuste/logs', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.getAdjustmentLogs));

router.get('/:id', asyncHandler(inventoryController.getInventoryItem));
router.post('/', requireRoles(['admin', 'encargado', 'operador']), asyncHandler(inventoryController.createInventoryItem));
router.post('/:id/imagen', requireRoles(['admin', 'encargado', 'operador']), asyncHandler(inventoryController.uploadInventoryImage));
router.delete('/:id/imagen', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.deleteInventoryImage));
router.post('/:id/aprobar', requireRoles(['admin']), asyncHandler(inventoryController.approveInventoryItem));
router.post('/:id/rechazar', requireRoles(['admin']), asyncHandler(inventoryController.rejectInventoryItem));
router.put('/:id', requireRoles(['admin']), asyncHandler(inventoryController.updateInventoryItem));
router.delete('/:id', requireRoles(['admin']), asyncHandler(inventoryController.deleteInventoryItem));

module.exports = router;
