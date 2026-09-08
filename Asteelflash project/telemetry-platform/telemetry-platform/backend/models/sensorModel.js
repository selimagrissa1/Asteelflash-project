/**
 * sensorModel.js
 * --------------
 * Source des mesures capteur (temperature + humidite).
 *
 * Aujourd'hui : lues depuis data/sensor_readings.json, alimente par
 * simulate-sensor.js (ou par tout script de test).
 *
 * Evolution prevue : remplacer uniquement `appendReading`/`getHistory`
 * par une lecture UART/RF de la carte CC1310 (DHT11). Les routes et le
 * frontend ne dependent que du contrat retourne par ce module.
 */

const { readJSON, writeJSON } = require('../config/jsonStore');

const STORE_NAME = 'sensor_readings';
const MAX_READINGS = 500;

// Au-dela de cette duree sans nouvelle mesure, le capteur est considere
// "hors ligne" (absence de donnees) par l'API de statut.
const STALE_AFTER_MS = 15000;

function getAll() {
  return readJSON(STORE_NAME, []);
}

function getHistory(limit = 50) {
  return getAll().slice(-limit);
}

function getLatest() {
  const all = getAll();
  return all.length > 0 ? all[all.length - 1] : null;
}

function appendReading({ temperature, humidity, source }) {
  const readings = getAll();
  readings.push({
    temperature,
    humidity,
    source: source === 'remote' ? 'remote' : 'local',
    timestamp: new Date().toISOString(),
  });
  writeJSON(STORE_NAME, readings.slice(-MAX_READINGS));
}

function getStatus() {
  const latest = getLatest();
  if (!latest) return 'no-data';

  const age = Date.now() - new Date(latest.timestamp).getTime();
  return age > STALE_AFTER_MS ? 'no-data' : 'connected';
}

function getStatusBySource(source) {
  const latest = getLatestBySource(source);
  if (!latest) return 'no-data';

  const age = Date.now() - new Date(latest.timestamp).getTime();
  return age > STALE_AFTER_MS ? 'no-data' : 'connected';
}

/* ------------------------------------------------------------------ */
/* Helpers pour la comparaison MOI / ELLE                              */
/* ------------------------------------------------------------------ */

function bySource(source, limit = 50) {
  return getAll()
    .filter((r) => (r.source || 'local') === source)
    .slice(-limit);
}

function getLatestBySource(source) {
  const filtered = bySource(source, MAX_READINGS);
  return filtered.length > 0 ? filtered[filtered.length - 1] : null;
}

function getDelta() {
  const latestLocal = getLatestBySource('local');
  const latestRemote = getLatestBySource('remote');
  if (!latestLocal || !latestRemote) return null;
  return {
    temperature: Math.round((latestLocal.temperature - latestRemote.temperature) * 100) / 100,
    humidity: Math.round((latestLocal.humidity - latestRemote.humidity) * 100) / 100,
  };
}

module.exports = {
  getHistory,
  getLatest,
  appendReading,
  getStatus,
  getStatusBySource,   // AJOUT
  bySource,
  getLatestBySource,
  getDelta,
};
