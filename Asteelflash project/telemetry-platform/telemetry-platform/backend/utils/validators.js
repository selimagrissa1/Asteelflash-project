/**
 * validators.js
 * -------------
 * Validation des formulaires cote serveur (ne jamais faire confiance au
 * seul controle cote client). Retourne un tableau d'erreurs (vide si OK).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

function validateUsername(username) {
  if (!username || !USERNAME_REGEX.test(username)) {
    return "Le nom d'utilisateur doit contenir 3 à 20 caractères (lettres, chiffres, - ou _).";
  }
  return null;
}

function validateEmail(email) {
  if (!email || !EMAIL_REGEX.test(email)) {
    return "L'adresse e-mail n'est pas valide.";
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre.';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre.';
  }
  return null;
}

function validateThresholds({ tempMin, tempMax, humMin, humMax }) {
  const errors = [];
  const values = { tempMin, tempMax, humMin, humMax };

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === '' || Number.isNaN(parseFloat(value))) {
      errors.push(`Le champ ${key} doit être un nombre.`);
    }
  });

  if (errors.length === 0) {
    if (parseFloat(tempMin) >= parseFloat(tempMax)) {
      errors.push('La température minimale doit être inférieure à la température maximale.');
    }
    if (parseFloat(humMin) >= parseFloat(humMax)) {
      errors.push("L'humidité minimale doit être inférieure à l'humidité maximale.");
    }
  }

  return errors;
}

module.exports = { validateUsername, validateEmail, validatePassword, validateThresholds };
