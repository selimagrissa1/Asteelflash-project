# Plateforme de Télémétrie CC1310 / DHT11 — Authentification & Rôles

Plateforme web complète : dashboard de télémétrie (température/humidité) existant
conservé et étendu, avec authentification, gestion des utilisateurs, et séparation
des rôles Administrateur / Utilisateur.

## Installation

```bash
cd backend
npm install
npm start
```

Ouvrir : **http://localhost:3000**

> ⚠️ **Important — testé uniquement par relecture, pas par exécution.**
> Le bac à sable dans lequel ce projet a été généré bloque l'accès au registre
> npm (`registry.npmjs.org` renvoie une erreur 403 côté proxy). Tous les
> fichiers `.js` ont été validés avec `node --check` (syntaxe correcte), mais
> je n'ai pas pu exécuter `npm install` ni démarrer le serveur pour un test de
> bout en bout. Fais-moi remonter la moindre erreur au premier lancement, je
> corrige immédiatement.

### Compte administrateur par défaut

Au premier démarrage (base `data/users.json` vide), un compte admin est créé automatiquement :

| Champ | Valeur |
|---|---|
| Identifiant | `admin` |
| E-mail | `admin@example.com` |
| Mot de passe | `Admin123!` |

**Change ce mot de passe immédiatement** depuis la page de profil après la première connexion.

### Simuler des mesures capteur (en attendant la CC1310)

Dans un second terminal :
```bash
cd backend
npm run simulate
```

## Structure du projet

```
telemetry-platform/
└── backend/
    ├── server.js                  # Point d'entrée : sessions, routes, erreurs
    ├── simulate-sensor.js         # Génère des mesures de test
    ├── package.json
    ├── config/
    │   └── jsonStore.js           # Persistance JSON générique (base de données fichier)
    ├── models/
    │   ├── userModel.js           # Comptes, rôles, hash bcrypt, jetons de reset
    │   ├── thresholdModel.js      # Seuils température/humidité
    │   ├── logModel.js            # Journal d'actions + historique de connexion
    │   └── sensorModel.js         # Lecture/écriture des mesures capteur
    ├── middleware/
    │   ├── auth.js                # requireAuth / requireRole('admin')
    │   └── flash.js               # Messages de confirmation/erreur
    ├── routes/
    │   ├── authRoutes.js          # /login /register /logout /forgot-password /reset-password
    │   ├── dashboardRoutes.js     # /dashboard + API JSON /api/sensor/*
    │   ├── adminRoutes.js         # /admin/users (recherche, filtre, pagination, rôle, suppression)
    │   └── profileRoutes.js       # /profile (infos + mot de passe)
    ├── utils/
    │   ├── validators.js          # Validation des formulaires
    │   └── avatar.js              # Initiales + couleur d'avatar
    ├── data/                      # Persistance (créée/complétée automatiquement)
    │   ├── users.json
    │   ├── thresholds.json
    │   ├── sensor_readings.json
    │   ├── loginHistory.json
    │   └── actionLogs.json
    ├── views/                     # Templates EJS (rendu serveur)
    │   ├── partials/               (head, navbar, footer, flash, dashboard-body)
    │   ├── login.ejs, register.ejs, forgot-password.ejs, reset-password.ejs
    │   ├── dashboard-admin.ejs, dashboard-user.ejs
    │   ├── admin-users.ejs, profile.ejs
    │   └── error-403.ejs, error-404.ejs, error-500.ejs
    └── public/
        ├── css/style.css          # Thème sombre (repris du dashboard existant)
        └── js/dashboard.js        # Polling API, jauges, alertes, graphique canvas
```

## Pourquoi un rendu serveur (EJS) plutôt qu'une SPA ?

La consigne "un utilisateur non connecté ne doit jamais pouvoir accéder au
tableau de bord" ne peut pas être garantie par du JavaScript côté client seul
(un utilisateur peut toujours ouvrir les outils développeur et contourner une
vérification purement client). Chaque page privée est donc protégée **côté
serveur** par le middleware `requireAuth` / `requireRole('admin')` : la page
n'est même pas envoyée au navigateur si l'utilisateur n'a pas les droits.

Le dashboard continue cependant à se comporter comme avant côté navigateur :
`dashboard.js` interroge `/api/sensor/history` toutes les 2 secondes en
JavaScript pur, sans rechargement de page.

## Sécurité — ce qui est fait et ses limites (à lire avant mise en production)

- **Mots de passe** : jamais stockés en clair, hashés avec `bcryptjs` (implémentation JS pure, sans compilation native — évite les soucis d'installation rencontrés précédemment sous Windows).
- **Sessions** : `express-session`, cookie `httpOnly`. Le secret de session est en dur par défaut (`dev-secret-a-changer-en-production`) : **définis la variable d'environnement `SESSION_SECRET` avant tout déploiement réel.**
- **Autorisations** : vérifiées à chaque requête sur le serveur, jamais seulement côté client.
- **Mot de passe oublié** : aucun serveur SMTP n'est configuré dans ce projet. Le lien de réinitialisation est affiché directement à l'écran et journalisé côté serveur (`console.log`) — clairement marqué comme un mode démo dans le code (`authRoutes.js`). Pour un usage réel, brancher un service d'envoi d'e-mails (ex. Nodemailer + SendGrid/Mailgun) à la place de ce bloc.
- **Persistance** : base "fichier JSON", suffisante pour ce projet mais sans verrouillage concurrentiel — ne pas utiliser telle quelle avec de nombreux utilisateurs simultanés en écriture. Migration vers SQLite/PostgreSQL possible en ne touchant qu'à `config/jsonStore.js` et aux modèles.
- **Suppression du compte administrateur courant** : bloquée côté serveur (`adminRoutes.js`), pas seulement masquée dans l'interface.

## Évolution vers la carte CC1310 (DHT11 en UART/RF) — déjà en place

Le pont série est fait : `acquisition/dht11_logger.py` lit les trames de la
CC1310, les enregistre dans un CSV **et** les envoie au dashboard via
`POST /api/ingest`.

```
acquisition/
└── dht11_logger.py    # pip install pyserial requests
```

### Route d'ingestion (`routes/ingestRoutes.js`)

```
POST /api/ingest
Header : X-API-Key: cc1310-dev-key
Body   : { "temperature": 23.4, "humidity": 55.0 }
```

Elle n'exige **pas** de session utilisateur (le script Python ne peut pas se
"connecter" comme un humain) : elle est protégée uniquement par une clé
partagée. **Change `INGEST_API_KEY` avant tout déploiement réel** en la
définissant comme variable d'environnement des deux côtés (serveur et
script Python) :

```bash
# côté serveur
set INGEST_API_KEY=une-cle-longue-et-aleatoire      # Windows (cmd)
$env:INGEST_API_KEY="une-cle-longue-et-aleatoire"    # Windows (PowerShell)
export INGEST_API_KEY=une-cle-longue-et-aleatoire    # Linux / macOS
```

et modifier `API_KEY` en haut de `dht11_logger.py` avec la même valeur.

### Utilisation

```bash
# Terminal 1 — le serveur
cd backend
npm install
npm start

# Terminal 2 — l'acquisition depuis la CC1310
cd acquisition
pip install pyserial requests
python dht11_logger.py
```

Ouvre ensuite le dashboard (connecté) : les mesures reçues par le script
Python apparaissent automatiquement, sans rechargement de page (le
navigateur interroge `/api/sensor/history` toutes les 2 secondes).
