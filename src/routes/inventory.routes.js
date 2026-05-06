const express = require('express');
const inventoryController = require('../controllers/inventory.controller');
const { requireSession, requireRoles } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', asyncHandler(inventoryController.listInventory));
router.get('/:id', asyncHandler(inventoryController.getInventoryItem));
router.post('/', requireRoles(['admin', 'encargado']), asyncHandler(inventoryController.createInventoryItem));
router.put('/:id', requireRoles(['admin']), asyncHandler(inventoryController.updateInventoryItem));
router.delete('/:id', requireRoles(['admin']), asyncHandler(inventoryController.deleteInventoryItem));

module.exports = router;
