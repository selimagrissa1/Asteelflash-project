const express = require('express');
const crypto = require('crypto');

const userModel = require('../models/userModel');
const logModel = require('../models/logModel');
const { validateUsername, validateEmail, validatePassword } = require('../utils/validators');

const router = express.Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure
const REMEMBER_ME_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

/* ------------------------------------------------------------------ */
/* Inscription                                                         */
/* ------------------------------------------------------------------ */

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { pageTitle: 'Créer un compte', errors: [], formData: {} });
});

router.post('/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  const errors = [];

  const usernameError = validateUsername(username);
  if (usernameError) errors.push(usernameError);

  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);

  const passwordError = validatePassword(password);
  if (passwordError) errors.push(passwordError);

  if (password !== confirmPassword) {
    errors.push('Les deux mots de passe ne correspondent pas.');
  }

  if (errors.length === 0 && userModel.existsByUsernameOrEmail(username, email)) {
    errors.push("Ce nom d'utilisateur ou cette adresse e-mail est déjà utilisé.");
  }

  if (errors.length > 0) {
    return res.status(400).render('register', {
      pageTitle: 'Créer un compte',
      errors,
      formData: { username, email },
    });
  }

  const user = userModel.create({ username, email, password, role: 'user' });
  logModel.logAction(user.username, 'user_registered', `Nouveau compte créé (${user.email})`);

  req.flash('success', 'Compte créé avec succès. Vous pouvez maintenant vous connecter.');
  res.redirect('/login');
});

/* ------------------------------------------------------------------ */
/* Connexion / déconnexion                                             */
/* ------------------------------------------------------------------ */

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { pageTitle: 'Connexion', errors: [], formData: {} });
});

router.post('/login', (req, res) => {
  const { identifier, password, rememberMe } = req.body;
  const user = userModel.findByUsernameOrEmail(identifier || '');

  if (!user || !userModel.verifyPassword(user, password || '')) {
    return res.status(401).render('login', {
      pageTitle: 'Connexion',
      errors: ["Identifiant ou mot de passe incorrect."],
      formData: { identifier },
    });
  }

  req.session.user = userModel.toSafeObject(user);

  if (rememberMe) {
    req.session.cookie.maxAge = REMEMBER_ME_MS;
  }

  userModel.updateLastLogin(user.id);
  logModel.logLogin(user.id, user.username, req);
  logModel.logAction(user.username, 'login', 'Connexion réussie');

  const returnTo = req.session.returnTo;
  delete req.session.returnTo;

  req.flash('success', `Bienvenue, ${user.username} !`);
  res.redirect(returnTo || '/dashboard');
});

router.post('/logout', (req, res) => {
  const username = req.session.user ? req.session.user.username : 'inconnu';
  logModel.logAction(username, 'logout', 'Déconnexion');

  req.session.destroy(() => {
    res.redirect('/login');
  });
});

/* ------------------------------------------------------------------ */
/* Mot de passe oublié (mode démo : pas d'envoi d'e-mail réel)          */
/* ------------------------------------------------------------------ */

router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { pageTitle: 'Mot de passe oublié', errors: [], resetLink: null });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = userModel.findByEmail(email || '');

  if (!user) {
    // On ne revele pas si l'e-mail existe ou non (bonne pratique de securite).
    return res.render('forgot-password', {
      pageTitle: 'Mot de passe oublié',
      errors: [],
      resetLink: null,
      infoMessage:
        "Si un compte est associé à cette adresse, un lien de réinitialisation vient d'être généré.",
    });
  }

  const token = crypto.randomBytes(24).toString('hex');
  userModel.setResetToken(user.id, token, Date.now() + RESET_TOKEN_TTL_MS);
  logModel.logAction(user.username, 'password_reset_requested', 'Demande de réinitialisation');

  // Pas de serveur SMTP configure dans ce projet : le lien est affiche
  // directement (mode demo) et journalise cote serveur. En production,
  // remplacer ce bloc par un envoi via un service d'e-mail (ex: Nodemailer).
  const resetLink = `/reset-password/${token}`;
  console.log(`[DEMO] Lien de réinitialisation pour ${user.email} : ${resetLink}`);

  res.render('forgot-password', {
    pageTitle: 'Mot de passe oublié',
    errors: [],
    resetLink,
  });
});

router.get('/reset-password/:token', (req, res) => {
  const user = userModel.findByResetToken(req.params.token);
  if (!user) {
    req.flash('error', 'Ce lien de réinitialisation est invalide ou a expiré.');
    return res.redirect('/forgot-password');
  }
  res.render('reset-password', { pageTitle: 'Nouveau mot de passe', errors: [], token: req.params.token });
});

router.post('/reset-password/:token', (req, res) => {
  const user = userModel.findByResetToken(req.params.token);
  if (!user) {
    req.flash('error', 'Ce lien de réinitialisation est invalide ou a expiré.');
    return res.redirect('/forgot-password');
  }

  const { password, confirmPassword } = req.body;
  const errors = [];

  const passwordError = validatePassword(password);
  if (passwordError) errors.push(passwordError);
  if (password !== confirmPassword) errors.push('Les deux mots de passe ne correspondent pas.');

  if (errors.length > 0) {
    return res.status(400).render('reset-password', {
      pageTitle: 'Nouveau mot de passe',
      errors,
      token: req.params.token,
    });
  }

  userModel.updatePassword(user.id, password);
  logModel.logAction(user.username, 'password_reset', 'Mot de passe réinitialisé via lien');

  req.flash('success', 'Mot de passe mis à jour. Vous pouvez vous connecter.');
  res.redirect('/login');
});

module.exports = router;
