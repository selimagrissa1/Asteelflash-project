/**
 * logModel.js
 * -----------
 * Journalisation des evenements importants (connexion, deconnexion,
 * modification des seuils, creation/suppression d'utilisateurs, etc.)
 * et historique des connexions.
 *
 * Les deux journaux sont bornes en taille (MAX_ENTRIES) pour eviter une
 * croissance illimitee des fichiers JSON au fil du temps.
 */

const { readJSON, writeJSON } = require('../config/jsonStore');

const MAX_ENTRIES = 500;

/* ---------------------------- Journal d'actions --------------------- */

function logAction(actorUsername, action, details = '') {
  const logs = readJSON('actionLogs', []);
  logs.unshift({
    timestamp: new Date().toISOString(),
    actor: actorUsername || 'système',
    action,
    details,
  });
  writeJSON('actionLogs', logs.slice(0, MAX_ENTRIES));
}

function getActionLogs(limit = 100) {
  return readJSON('actionLogs', []).slice(0, limit);
}

/* ---------------------------- Historique de connexion ---------------- */

function logLogin(userId, username, req) {
  const history = readJSON('loginHistory', []);
  history.unshift({
    userId,
    username,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress || 'inconnue',
    userAgent: req.get ? req.get('User-Agent') : 'inconnu',
  });
  writeJSON('loginHistory', history.slice(0, MAX_ENTRIES));
}

function getLoginHistory(userId, limit = 5) {
  return readJSON('loginHistory', [])
    .filter((entry) => entry.userId === userId)
    .slice(0, limit);
}

module.exports = { logAction, getActionLogs, logLogin, getLoginHistory };
