const express = require('express');
const reportController = require('../controllers/report.controller');
const { requireSession, requireRoles } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

router.use(requireSession);

router.get('/', asyncHandler(reportController.getReport));
router.get('/estadisticas', requireRoles(['admin', 'encargado']), asyncHandler(reportController.getStats));

module.exports = router;
