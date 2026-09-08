/**
 * auth.js
 * -------
 * Middlewares de protection des routes :
 *  - requireAuth  : bloque l'acces si aucune session utilisateur active
 *  - requireRole  : bloque l'acces si le role ne correspond pas (403)
 *  - attachUser   : expose l'utilisateur courant a toutes les vues (res.locals)
 */

const userModel = require('../models/userModel');

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }

  // Recharge l'utilisateur depuis la base pour eviter de travailler avec
  // des informations de session perimees (ex: role modifie entre-temps).
  const fresh = userModel.findById(req.session.user.id);
  if (!fresh) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }

  req.session.user = userModel.toSafeObject(fresh);
  res.locals.currentUser = req.session.user;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }
    if (req.session.user.role !== role) {
      return res.status(403).render('error-403', {
        pageTitle: 'Accès interdit',
      });
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
