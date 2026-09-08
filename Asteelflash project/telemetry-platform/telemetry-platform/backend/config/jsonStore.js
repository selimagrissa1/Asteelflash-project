/**
 * jsonStore.js
 * ------------
 * Petite couche de persistance "fichier JSON" utilisée comme base de
 * données pour ce projet (utilisateurs, seuils, historiques, logs).
 *
 * Pourquoi pas une vraie base de données ?
 *  - Pas de dépendance native à compiler (évite les soucis d'installation
 *    sous Windows rencontrés precedemment avec certains modules).
 *  - Suffisant pour le volume de donnees d'un projet IoT pedagogique.
 *  - Facilement remplaçable plus tard par SQLite/PostgreSQL/MongoDB :
 *    seule cette couche devrait changer, pas les modeles qui l'appellent.
 *
 * Toutes les ecritures sont synchrones et volontairement simples
 * (pas de verrou concurrentiel) : adapte a une seule instance de serveur.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

/**
 * Lit un fichier JSON. Si le fichier n'existe pas, le cree avec la
 * valeur par defaut fournie et la retourne.
 */
function readJSON(name, defaultValue) {
  const file = filePath(name);

  if (!fs.existsSync(file)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }

  const raw = fs.readFileSync(file, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Fichier JSON corrompu (${name}.json), réinitialisation.`, err);
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
}

function writeJSON(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

module.exports = { readJSON, writeJSON };
