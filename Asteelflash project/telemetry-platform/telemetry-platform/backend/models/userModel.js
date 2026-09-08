/**
 * userModel.js
 * ------------
 * Gestion des comptes utilisateurs : creation, authentification, roles,
 * unicite email/username, jeton de reinitialisation de mot de passe.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { readJSON, writeJSON } = require('../config/jsonStore');

const STORE_NAME = 'users';
const SALT_ROUNDS = 10;

function loadAll() {
  return readJSON(STORE_NAME, []);
}

function saveAll(users) {
  writeJSON(STORE_NAME, users);
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username).trim();
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

function findAll() {
  return loadAll();
}

function findById(id) {
  return loadAll().find((u) => u.id === id) || null;
}

function findByEmail(email) {
  const target = normalizeEmail(email);
  return loadAll().find((u) => normalizeEmail(u.email) === target) || null;
}

function findByUsername(username) {
  const target = normalizeUsername(username).toLowerCase();
  return loadAll().find((u) => normalizeUsername(u.username).toLowerCase() === target) || null;
}

function findByUsernameOrEmail(identifier) {
  return findByUsername(identifier) || findByEmail(identifier);
}

function findByResetToken(token) {
  return (
    loadAll().find(
      (u) => u.resetToken === token && u.resetTokenExpiresAt && u.resetTokenExpiresAt > Date.now()
    ) || null
  );
}

function existsByUsernameOrEmail(username, email, excludeId = null) {
  const users = loadAll();
  return users.some((u) => {
    if (excludeId && u.id === excludeId) return false;
    return (
      normalizeUsername(u.username).toLowerCase() === normalizeUsername(username).toLowerCase() ||
      normalizeEmail(u.email) === normalizeEmail(email)
    );
  });
}

/* ------------------------------------------------------------------ */
/* Ecriture                                                            */
/* ------------------------------------------------------------------ */

function create({ username, email, password, role = 'user' }) {
  const users = loadAll();

  const user = {
    id: generateId(),
    username: normalizeUsername(username),
    email: normalizeEmail(email),
    passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
    role, // 'admin' | 'user'
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    resetToken: null,
    resetTokenExpiresAt: null,
  };

  users.push(user);
  saveAll(users);
  return user;
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

function updateLastLogin(id) {
  const users = loadAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.lastLoginAt = new Date().toISOString();
  saveAll(users);
  return user;
}

function updateRole(id, role) {
  const users = loadAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.role = role;
  saveAll(users);
  return user;
}

function updateProfile(id, { username, email }) {
  const users = loadAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.username = normalizeUsername(username);
  user.email = normalizeEmail(email);
  saveAll(users);
  return user;
}

function updatePassword(id, newPassword) {
  const users = loadAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  user.resetToken = null;
  user.resetTokenExpiresAt = null;
  saveAll(users);
  return user;
}

function setResetToken(id, token, expiresAt) {
  const users = loadAll();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.resetToken = token;
  user.resetTokenExpiresAt = expiresAt;
  saveAll(users);
  return user;
}

function remove(id) {
  const users = loadAll();
  const next = users.filter((u) => u.id !== id);
  saveAll(next);
  return next.length !== users.length;
}

/* ------------------------------------------------------------------ */
/* Amorçage : cree un compte administrateur par defaut si aucun compte  */
/* n'existe encore, pour permettre la premiere connexion.               */
/* ------------------------------------------------------------------ */

function ensureDefaultAdmin() {
  const users = loadAll();
  if (users.length > 0) return;

  create({
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin123!',
    role: 'admin',
  });

  console.log('----------------------------------------------------------');
  console.log('Compte administrateur par defaut cree :');
  console.log('  identifiant : admin');
  console.log('  email       : admin@example.com');
  console.log('  mot de passe: Admin123!');
  console.log('  => A changer immediatement depuis la page de profil.');
  console.log('----------------------------------------------------------');
}

/** Retourne une version sans champs sensibles, sûre à exposer aux vues */
function toSafeObject(user) {
  if (!user) return null;
  const { passwordHash, resetToken, resetTokenExpiresAt, ...safe } = user;
  return safe;
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  findByUsername,
  findByUsernameOrEmail,
  findByResetToken,
  existsByUsernameOrEmail,
  create,
  verifyPassword,
  updateLastLogin,
  updateRole,
  updateProfile,
  updatePassword,
  setResetToken,
  remove,
  ensureDefaultAdmin,
  toSafeObject,
};
