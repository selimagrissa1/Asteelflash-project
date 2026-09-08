/**
 * thresholdModel.js
 * -----------------
 * Seuils d'alerte temperature/humidite, persistes et modifiables
 * uniquement par un administrateur.
 */

const { readJSON, writeJSON } = require('../config/jsonStore');

const STORE_NAME = 'thresholds';

const DEFAULTS = {
  tempMin: 15,
  tempMax: 30,
  humMin: 30,
  humMax: 70,
  updatedAt: null,
  updatedBy: null,
};

function get() {
  return readJSON(STORE_NAME, DEFAULTS);
}

function update({ tempMin, tempMax, humMin, humMax }, updatedByUsername) {
  const next = {
    tempMin: parseFloat(tempMin),
    tempMax: parseFloat(tempMax),
    humMin: parseFloat(humMin),
    humMax: parseFloat(humMax),
    updatedAt: new Date().toISOString(),
    updatedBy: updatedByUsername,
  };
  writeJSON(STORE_NAME, next);
  return next;
}

module.exports = { get, update };
