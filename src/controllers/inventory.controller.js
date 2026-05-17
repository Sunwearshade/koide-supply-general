const inventoryService = require('../services/inventory.service');
const { createSystemMessage } = require('../services/system-message.service');

async function listInventory(req, res) {
  const result = await inventoryService.listInventory({
    q: req.query.q || '',
    page: req.query.page,
    limit: req.query.limit,
    all: req.query.all === '1'
  });
  res.json(result);
}

async function getInventoryItem(req, res) {
  const item = await inventoryService.getInventoryItem(req.params.id);
  res.json(item);
}

async function createInventoryItem(req, res) {
  const item = await inventoryService.createInventoryItem(req.body, req.session.user);
  const isPending = item.estado_revision === 'pendiente';
  await createSystemMessage({
    type: isPending ? 'inventario_alta_pendiente' : 'inventario_alta',
    message: isPending
      ? `${req.session.user.nombre} solicito el alta de la refaccion ${item.descripcion}`
      : `${req.session.user.nombre} dio de alta la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.status(201).json(item);
}

async function listPendingInventory(req, res) {
  const items = await inventoryService.listPendingInventory();
  res.json(items);
}

async function approveInventoryItem(req, res) {
  const item = await inventoryService.approveInventoryItem(req.params.id, req.session.user);
  await createSystemMessage({
    type: 'inventario_alta_aprobada',
    message: `${req.session.user.nombre} aprobo el alta de la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function rejectInventoryItem(req, res) {
  const item = await inventoryService.rejectInventoryItem(req.params.id, req.session.user);
  await createSystemMessage({
    type: 'inventario_alta_rechazada',
    message: `${req.session.user.nombre} rechazo el alta de la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function updateInventoryItem(req, res) {
  const item = await inventoryService.updateInventoryItem(req.params.id, req.body);
  await createSystemMessage({
    type: 'inventario_editado',
    message: `${req.session.user.nombre} edito la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function deleteInventoryItem(req, res) {
  const result = await inventoryService.deleteInventoryItem(req.params.id);
  await createSystemMessage({
    type: 'inventario_desactivado',
    message: `${req.session.user.nombre} desactivo una refaccion de inventario`,
    userId: req.session.user.id_usuario
  });
  res.json(result);
}

module.exports = {
  listInventory,
  getInventoryItem,
  createInventoryItem,
  listPendingInventory,
  approveInventoryItem,
  rejectInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
};
