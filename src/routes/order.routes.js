const express = require('express');
const orderController = require('../controllers/order.controller');
const { requireSession, requireRoles } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', asyncHandler(orderController.listOrders));   // acepta ?date=YYYY-MM-DD
router.get('/:id', asyncHandler(orderController.getOrder));
router.get('/:id/pdf', asyncHandler(orderController.downloadOrderPdf));
router.post('/', asyncHandler(orderController.createOrder));
router.post('/:id/confirmar', requireRoles(['admin', 'encargado']), asyncHandler(orderController.confirmOrder));
router.post('/:id/cancelar', requireRoles(['admin', 'encargado']), asyncHandler(orderController.cancelOrder));
router.post('/:id/revertir', requireRoles(['admin', 'encargado']), asyncHandler(orderController.revertOrder));

module.exports = router;
