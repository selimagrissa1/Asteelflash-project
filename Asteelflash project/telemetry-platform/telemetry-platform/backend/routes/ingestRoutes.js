const express = require('express');

const sensorModel = require('../models/sensorModel');
const logModel = require('../models/logModel');
const thresholdModel = require('../models/thresholdModel');   // AJOUT
const alertModel = require('../models/alertModel');           // AJOUT

const router = express.Router();

const INGEST_API_KEY = process.env.INGEST_API_KEY || 'cc1310-dev-key';

function requireApiKey(req, res, next) {
  const key = req.get('X-API-Key');
  if (key !== INGEST_API_KEY) {
    return res.status(401).json({ error: 'Clé API invalide ou absente (en-tête X-API-Key).' });
  }
  next();
}

router.post('/api/ingest', requireApiKey, (req, res) => {
  const { temperature, humidity } = req.body;
  const source = req.body.source === 'remote' ? 'remote' : 'local';

  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return res.status(400).json({ error: 'Le champ "temperature" doit être un nombre.' });
  }
  if (typeof humidity !== 'number' || Number.isNaN(humidity)) {
    return res.status(400).json({ error: 'Le champ "humidity" doit être un nombre.' });
  }

  sensorModel.appendReading({ temperature, humidity, source });
  logModel.logAction(
    'CC1310 (capteur)',
    'sensor_reading_ingested',
    `[${source}] T=${temperature}°C H=${humidity}%`
  );

  // AJOUT : détection d'alertes par rapport aux seuils actuels
  const thresholds = thresholdModel.get();

  if (temperature < thresholds.tempMin) {
    alertModel.addAlertIfNeeded({ type: 'temperature', level: 'low', value: temperature, threshold: thresholds.tempMin, source });
  }
  if (temperature > thresholds.tempMax) {
    alertModel.addAlertIfNeeded({ type: 'temperature', level: 'high', value: temperature, threshold: thresholds.tempMax, source });
  }
  if (humidity < thresholds.humMin) {
    alertModel.addAlertIfNeeded({ type: 'humidity', level: 'low', value: humidity, threshold: thresholds.humMin, source });
  }
  if (humidity > thresholds.humMax) {
    alertModel.addAlertIfNeeded({ type: 'humidity', level: 'high', value: humidity, threshold: thresholds.humMax, source });
  }

  res.status(201).json({ status: 'ok' });
});

module.exports = router;