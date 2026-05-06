const express = require('express');
const orderController = require('../controllers/order.controller');
const { requireSession } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', asyncHandler(orderController.listOrders));
router.get('/:id', asyncHandler(orderController.getOrder));
router.get('/:id/pdf', asyncHandler(orderController.downloadOrderPdf));
router.post('/', asyncHandler(orderController.createOrder));
router.post('/:id/confirmar', asyncHandler(orderController.confirmOrder));
router.post('/:id/cancelar', asyncHandler(orderController.cancelOrder));
router.post('/:id/revertir', asyncHandler(orderController.revertOrder));

module.exports = router;
