/**
 * server.js
 * ---------
 * Point d'entree de la plateforme de telemetrie.
 * Assemble : sessions, middlewares (auth, flash), routes, moteur de vues
 * EJS, et gestion centralisee des erreurs 404 / 500.
 */

const path = require('path');
const express = require('express');
const session = require('express-session');

const { attachUser } = require('./middleware/auth');
const flashMiddleware = require('./middleware/flash');
const { getInitials, getColor } = require('./utils/avatar');

const userModel = require('./models/userModel');
const alertModel = require('./models/alertModel');   

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const profileRoutes = require('./routes/profileRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const alertRoutes = require('./routes/alertRoutes');   // AJOUT


const app = express();
const PORT = process.env.PORT || 3000;

// Amorce un compte administrateur par defaut si la base est vide
userModel.ensureDefaultAdmin();

/* ------------------------------------------------------------------ */
/* Configuration du moteur de vues                                     */
/* ------------------------------------------------------------------ */

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ------------------------------------------------------------------ */
/* Middlewares globaux                                                  */
/* ------------------------------------------------------------------ */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    // IMPORTANT : en production, definir SESSION_SECRET via une variable
    // d'environnement plutot que d'utiliser cette valeur par defaut.
    secret: process.env.SESSION_SECRET || 'dev-secret-a-changer-en-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 4, // 4h par defaut (sans "se souvenir de moi")
    },
  })
);

app.use(flashMiddleware);
app.use(attachUser);

// Rendues disponibles dans tous les templates EJS
app.use((req, res, next) => {
  res.locals.getInitials = getInitials;
  res.locals.getAvatarColor = getColor;
  res.locals.alertCount = req.session.user ? alertModel.getRecentCount() : 0;   
  next();
});

/* ------------------------------------------------------------------ */
/* Routes                                                               */
/* ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/dashboard' : '/login');
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(adminRoutes);
app.use(profileRoutes);
app.use(ingestRoutes);
app.use(alertRoutes);   // AJOUT

/* ------------------------------------------------------------------ */
/* Erreurs : 404 puis 500                                               */
/* ------------------------------------------------------------------ */

app.use((req, res) => {
  res.status(404).render('error-404', { pageTitle: 'Page introuvable' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  res.status(500).render('error-500', { pageTitle: 'Erreur serveur' });
});

app.listen(PORT, () => {
  console.log(`Plateforme de télémétrie disponible sur http://localhost:${PORT}`);
});

