const reportService = require('../services/report.service');

async function getReport(req, res) {
  const report = await reportService.getReport(req.query.period);
  res.json(report);
}

async function getStats(req, res) {
  const stats = await reportService.getStats(req.query.period);
  res.json(stats);
}

module.exports = {
  getReport,
  getStats
};
