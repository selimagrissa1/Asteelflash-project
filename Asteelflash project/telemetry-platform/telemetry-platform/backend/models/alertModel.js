/**
 * alertModel.js
 * -------------
 * Historique des alertes déclenchées lorsqu'une lecture capteur dépasse
 * les seuils définis (thresholdModel). Une seule lecture peut générer
 * plusieurs alertes (ex: température haute + humidité basse en même temps).
 */

const { readJSON, writeJSON } = require('../config/jsonStore');

const STORE_NAME = 'alerts';
const MAX_ALERTS = 500;

function getAll() {
  return readJSON(STORE_NAME, []);
}

function addAlert({ type, level, value, threshold, source }) {
  const alerts = getAll();
  alerts.unshift({
    type,      // 'temperature' | 'humidity'
    level,     // 'high' | 'low'
    value,
    threshold,
    source,    // 'local' | 'remote'
    timestamp: new Date().toISOString(),
  });
  writeJSON(STORE_NAME, alerts.slice(0, MAX_ALERTS));
}

function getHistory(limit = 100) {
  return getAll().slice(0, limit);
}

function getAlertName(type, level) {
  if (type === 'temperature' && level === 'high') return 'Température élevée';
  if (type === 'temperature' && level === 'low') return 'Température basse';
  if (type === 'humidity' && level === 'high') return 'Humidité élevée';
  if (type === 'humidity' && level === 'low') return 'Humidité basse';
  return 'Alerte';
}


const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes entre deux alertes identiques (meme type/niveau/capteur)

function addAlertIfNeeded({ type, level, value, threshold, source }) {
  const alerts = getAll();
  const lastSame = alerts.find(
    (a) => a.type === type && a.level === level && a.source === source
  );

  if (lastSame) {
    const age = Date.now() - new Date(lastSame.timestamp).getTime();
    if (age < COOLDOWN_MS) return; // trop recente, on ignore pour eviter le spam
  }

  addAlert({ type, level, value, threshold, source });
}

function getRecentCount(sinceMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - sinceMs;
  return getAll().filter((a) => new Date(a.timestamp).getTime() >= cutoff).length;
}

module.exports = { addAlert, addAlertIfNeeded, getHistory, getAlertName, getRecentCount };