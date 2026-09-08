const express = require('express');

const { requireAuth } = require('../middleware/auth');
const userModel = require('../models/userModel');
const logModel = require('../models/logModel');
const { validateUsername, validateEmail, validatePassword } = require('../utils/validators');

const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  const loginHistory = logModel.getLoginHistory(req.session.user.id, 5);
  res.render('profile', {
    pageTitle: 'Mon profil',
    errors: [],
    loginHistory,
  });
});

router.post('/profile/update', requireAuth, (req, res) => {
  const { username, email } = req.body;
  const userId = req.session.user.id;
  const errors = [];

  const usernameError = validateUsername(username);
  if (usernameError) errors.push(usernameError);

  const emailError = validateEmail(email);
  if (emailError) errors.push(emailError);

  if (errors.length === 0 && userModel.existsByUsernameOrEmail(username, email, userId)) {
    errors.push("Ce nom d'utilisateur ou cette adresse e-mail est déjà utilisé par un autre compte.");
  }

  if (errors.length > 0) {
    return res.status(400).render('profile', {
      pageTitle: 'Mon profil',
      errors,
      loginHistory: logModel.getLoginHistory(userId, 5),
    });
  }

  const updated = userModel.updateProfile(userId, { username, email });
  req.session.user = userModel.toSafeObject(updated);

  logModel.logAction(updated.username, 'profile_updated', `username=${username}, email=${email}`);
  req.flash('success', 'Profil mis à jour avec succès.');
  res.redirect('/profile');
});

router.post('/profile/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.session.user.id;
  const user = userModel.findById(userId);
  const errors = [];

  if (!userModel.verifyPassword(user, currentPassword || '')) {
    errors.push('Le mot de passe actuel est incorrect.');
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) errors.push(passwordError);

  if (newPassword !== confirmPassword) {
    errors.push('Les deux nouveaux mots de passe ne correspondent pas.');
  }

  if (errors.length > 0) {
    return res.status(400).render('profile', {
      pageTitle: 'Mon profil',
      errors,
      loginHistory: logModel.getLoginHistory(userId, 5),
    });
  }

  userModel.updatePassword(userId, newPassword);
  logModel.logAction(user.username, 'password_changed', 'Mot de passe modifié depuis le profil');

  req.flash('success', 'Mot de passe modifié avec succès.');
  res.redirect('/profile');
});

module.exports = router;
