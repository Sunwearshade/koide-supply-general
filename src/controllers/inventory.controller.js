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
  const item = await inventoryService.createInventoryItem(req.body);
  await createSystemMessage({
    type: 'inventario_alta',
    message: `${req.session.user.nombre} dio de alta la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.status(201).json(item);
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
  updateInventoryItem,
  deleteInventoryItem
};
