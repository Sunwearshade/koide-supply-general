const movementService = require('../services/movement.service');

async function listMovements(req, res) {
  const movements = await movementService.listMovements();
  res.json(movements);
}

async function revertMovement(req, res) {
  const result = await movementService.revertMovement(
    req.params.id,
    req.session.user,
    req.body.motivo
  );
  res.status(201).json(result);
}

async function listSystemMessages(req, res) {
  const messages = await movementService.listSystemMessages({
    q: req.query.q,
    dateFrom: req.query.date_from,
    dateTo: req.query.date_to,
    page: req.query.page,
    limit: req.query.limit
  });
  res.json(messages);
}

async function getMovementDocument(req, res) {
  const document = await movementService.getMovementDocument(req.params.id);
  res.json(document);
}

module.exports = {
  listMovements,
  revertMovement,
  listSystemMessages,
  getMovementDocument
};
