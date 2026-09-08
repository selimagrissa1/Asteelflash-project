const express = require('express');

const { requireAuth } = require('../middleware/auth');
const thresholdModel = require('../models/thresholdModel');
const sensorModel = require('../models/sensorModel');
const logModel = require('../models/logModel');
const { validateThresholds } = require('../utils/validators');

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Page tableau de bord (vue differente selon le role, donnees        */
/* injectees cote serveur puis rafraichies en direct via l'API JSON)   */
/* ------------------------------------------------------------------ */

router.get('/dashboard', requireAuth, (req, res) => {
  const thresholds = thresholdModel.get();
  const history = sensorModel.getHistory(50);
  const latest = sensorModel.getLatest();
  const latestLocal = sensorModel.getLatestBySource('local');
  const latestRemote = sensorModel.getLatestBySource('remote');
  const delta = sensorModel.getDelta();
  const statusLocal = sensorModel.getStatusBySource('local');     // AJOUT
  const statusRemote = sensorModel.getStatusBySource('remote');   // AJOUT

  const viewName = req.session.user.role === 'admin' ? 'dashboard-admin' : 'dashboard-user';

  res.render(viewName, {
    pageTitle: 'Tableau de bord',
    thresholds,
    history,
    latest,
    latestLocal,
    latestRemote,
    delta,
    statusLocal,    // AJOUT
    statusRemote,   // AJOUT
  });
});

/* ------------------------------------------------------------------ */
/* Mise a jour des seuils (admin uniquement — la route est de toute    */
/* facon protegee une seconde fois dans adminRoutes.js)                 */
/* ------------------------------------------------------------------ */

router.post('/dashboard/thresholds', requireAuth, (req, res) => {
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error-403', { pageTitle: 'Accès interdit' });
  }

  const errors = validateThresholds(req.body);
  if (errors.length > 0) {
    req.flash('error', errors.join(' '));
    return res.redirect('/dashboard');
  }

  thresholdModel.update(req.body, req.session.user.username);
  logModel.logAction(
    req.session.user.username,
    'thresholds_updated',
    `Tmin=${req.body.tempMin} Tmax=${req.body.tempMax} Hmin=${req.body.humMin} Hmax=${req.body.humMax}`
  );

  req.flash('success', 'Seuils mis à jour avec succès.');
  res.redirect('/dashboard');
});

/* ------------------------------------------------------------------ */
/* API JSON utilisee par le frontend pour le polling temps reel        */
/* Accessible aux deux roles (lecture seule)                            */
/* ------------------------------------------------------------------ */

router.get('/api/sensor/history', requireAuth, (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
  res.json({
    readings: sensorModel.getHistory(limit),
    readingsLocal: sensorModel.bySource('local', limit),
    readingsRemote: sensorModel.bySource('remote', limit),
    thresholds: thresholdModel.get(),
    status: sensorModel.getStatus(),
    statusLocal: sensorModel.getStatusBySource('local'),     // AJOUT
    statusRemote: sensorModel.getStatusBySource('remote'),   // AJOUT
    delta: sensorModel.getDelta(),
  });
});

router.get('/api/sensor/latest', requireAuth, (req, res) => {
  res.json({
    latest: sensorModel.getLatest(),
    latestLocal: sensorModel.getLatestBySource('local'),
    latestRemote: sensorModel.getLatestBySource('remote'),
    thresholds: thresholdModel.get(),
    status: sensorModel.getStatus(),
    statusLocal: sensorModel.getStatusBySource('local'),     // AJOUT
    statusRemote: sensorModel.getStatusBySource('remote'),   // AJOUT
    delta: sensorModel.getDelta(),
  });
});

module.exports = router;
