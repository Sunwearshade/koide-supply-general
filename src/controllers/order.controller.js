const orderService = require('../services/order.service');
const movementService = require('../services/movement.service');
const { createSystemMessage } = require('../services/system-message.service');
const pdfService = require('../services/pdf.service');

async function listOrders(req, res) {
  const orders = await orderService.listOrders();
  res.json(orders);
}

async function getOrder(req, res) {
  const order = await orderService.getOrder(req.params.id);
  res.json(order);
}

async function createOrder(req, res) {
  const order = await orderService.createOrder({
    ...req.body,
    id_operador: req.body.id_operador || req.session.user.id_usuario
  });
  await createSystemMessage({
    type: 'orden_creada',
    message: `${req.session.user.nombre} creo la orden ${order.id_orden} de ${order.tipo}`,
    userId: req.session.user.id_usuario
  });
  res.status(201).json(order);
}

async function confirmOrder(req, res) {
  const idUsuario = req.session.user.id_usuario;
  const order = await orderService.confirmOrder(req.params.id, idUsuario);
  await createSystemMessage({
    type: 'orden_confirmada',
    message: `${req.session.user.nombre} confirmo la orden ${order.id_orden} de ${order.tipo}`,
    userId: req.session.user.id_usuario
  });
  res.json(order);
}

async function cancelOrder(req, res) {
  const order = await orderService.cancelOrder(req.params.id);
  await createSystemMessage({
    type: 'orden_cancelada',
    message: `${req.session.user.nombre} cancelo la orden ${order.id_orden} de ${order.tipo}`,
    userId: req.session.user.id_usuario
  });
  res.json(order);
}

async function revertOrder(req, res) {
  const reversals = await movementService.revertOrderMovements(
    req.params.id,
    req.session.user,
    req.body.motivo
  );
  res.status(201).json({ reversals });
}

async function downloadOrderPdf(req, res) {
  const order = await orderService.getOrder(req.params.id);
  if (order.tipo !== 'salida') {
    const error = new Error('El vale PDF solo aplica para salidas');
    error.status = 400;
    throw error;
  }

  const pdfBuffer = await pdfService.generateValePDF(order);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=vale_orden_${order.id_orden}.pdf`,
    'Content-Length': pdfBuffer.length
  });

  res.end(pdfBuffer);
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  confirmOrder,
  cancelOrder,
  revertOrder,
  downloadOrderPdf
};
