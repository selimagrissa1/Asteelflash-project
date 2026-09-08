const express = require('express');

const { requireAuth } = require('../middleware/auth');
const alertModel = require('../models/alertModel');

const router = express.Router();

router.get('/alerts', requireAuth, (req, res) => {
  const typeFilter = req.query.type || '';
  const sourceFilter = req.query.source || '';

  let alerts = alertModel.getHistory(500);

  if (typeFilter === 'temperature' || typeFilter === 'humidity') {
    alerts = alerts.filter((a) => a.type === typeFilter);
  }
  if (sourceFilter === 'local' || sourceFilter === 'remote') {
    alerts = alerts.filter((a) => a.source === sourceFilter);
  }

  alerts = alerts.slice(0, 100).map((a) => ({
    ...a,
    name: alertModel.getAlertName(a.type, a.level),
  }));

  res.render('alerts', {
    pageTitle: "Historique d'alertes",
    alerts,
    typeFilter,
    sourceFilter,
  });
});

module.exports = router;