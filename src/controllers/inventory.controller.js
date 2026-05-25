const inventoryService = require('../services/inventory.service');
const configService = require('../services/config.service');
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

async function uploadInventoryImage(req, res) {
  const item = await inventoryService.uploadInventoryImage(req.params.id, req.body || {});
  await createSystemMessage({
    type: 'inventario_imagen',
    message: `${req.session.user.nombre} cargo imagen para la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function deleteInventoryImage(req, res) {
  const item = await inventoryService.deleteInventoryImage(req.params.id);
  await createSystemMessage({
    type: 'inventario_imagen_eliminada',
    message: `${req.session.user.nombre} elimino imagen de la refaccion ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function getAdjustmentMode(req, res) {
  const mode = await configService.getAdjustmentMode();
  res.json(mode);
}

async function setAdjustmentMode(req, res) {
  const { estado } = req.body;
  if (!['inactivo', 'activo', 'en_revision'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inv\u00e1lido' });
  }

  const user = req.session.user;
  const rol = user && (user.rol || user.role);

  // El encargado solo puede enviar a revision, no activar ni desactivar el modo
  if (rol === 'encargado' && estado !== 'en_revision') {
    return res.status(403).json({ error: 'El encargado solo puede enviar el inventario a revisi\u00f3n' });
  }

  const result = await configService.setAdjustmentMode(estado, req.session.user);
  let actionStr = estado;
  if (estado === 'activo') actionStr = 'activ\u00f3';
  if (estado === 'inactivo') actionStr = 'desactiv\u00f3';
  if (estado === 'en_revision') actionStr = 'envi\u00f3 a revisi\u00f3n';

  await createSystemMessage({
    type: 'modo_ajuste_inventario',
    message: `${req.session.user.nombre} ${actionStr} el modo de ajuste general de inventario`,
    userId: req.session.user.id_usuario
  });
  res.json(result);
}

async function saveAdjustmentDraft(req, res) {
  const { items } = req.body;
  const result = await inventoryService.saveAdjustmentDraft(items, req.session.user);
  res.json(result);
}

async function getAdjustmentDraft(req, res) {
  const drafts = await inventoryService.getAdjustmentDraft();
  res.json(drafts);
}

async function saveAdjustmentNewItems(req, res) {
  const { items } = req.body;
  const result = await inventoryService.saveAdjustmentNewItems(items || [], req.session.user);
  res.json(result);
}

async function getAdjustmentNewItems(req, res) {
  const items = await inventoryService.getAdjustmentNewItems();
  res.json(items);
}

async function uploadAdjustmentNewItemImage(req, res) {
  const item = await inventoryService.uploadAdjustmentNewItemImage(req.params.id, req.body || {}, req.session.user);
  await createSystemMessage({
    type: 'ajuste_alta_imagen',
    message: `${req.session.user.nombre} cargo imagen para alta nueva ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function deleteAdjustmentNewItemImage(req, res) {
  const item = await inventoryService.deleteAdjustmentNewItemImage(req.params.id, req.session.user);
  await createSystemMessage({
    type: 'ajuste_alta_imagen_eliminada',
    message: `${req.session.user.nombre} elimino imagen de alta nueva ${item.descripcion}`,
    userId: req.session.user.id_usuario
  });
  res.json(item);
}

async function approveAdjustmentDraft(req, res) {
  const result = await inventoryService.approveAdjustmentDraft(req.session.user);
  res.json(result);
}

async function rejectAdjustmentDraft(req, res) {

  const result = await inventoryService.rejectAdjustmentDraft(req.session.user);
  res.json(result);
}

async function getAdjustmentLogs(req, res) {
  const result = await inventoryService.getAdjustmentLogs({
    page: req.query.page,
    limit: req.query.limit
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
  deleteInventoryItem,
  uploadInventoryImage,
  deleteInventoryImage,
  getAdjustmentMode,
  setAdjustmentMode,
  saveAdjustmentDraft,
  getAdjustmentDraft,
  saveAdjustmentNewItems,
  getAdjustmentNewItems,
  uploadAdjustmentNewItemImage,
  deleteAdjustmentNewItemImage,
  approveAdjustmentDraft,
  rejectAdjustmentDraft,
  getAdjustmentLogs
};
