/**
 * flash.js
 * --------
 * Mini-systeme de messages flash (succes/erreur) bases sur la session,
 * sans dependance externe. Un message pose avant une redirection est
 * affiche une seule fois, puis efface automatiquement.
 *
 * Usage :
 *   req.flash('success', 'Connexion réussie');
 *   res.redirect('/dashboard');
 */

function flashMiddleware(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session.flashMessages) req.session.flashMessages = [];
    req.session.flashMessages.push({ type, message });
  };

  res.locals.flashMessages = req.session.flashMessages || [];
  req.session.flashMessages = [];

  next();
}

module.exports = flashMiddleware;
