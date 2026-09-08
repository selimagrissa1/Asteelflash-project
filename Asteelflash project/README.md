# Liaison RF entre deux CC1310 — Capteur DHT11 vers PC

Ce dossier contient les firmwares des **deux cartes** nécessaires pour transmettre
température et humidité par radio (Sub-1GHz, EasyLink) entre une carte capteur
et une carte passerelle reliée au PC.

```
[DHT11] --DIO24--> [Carte A : CC1310 emetteur]
                          |
                       (RF EasyLink)
                          |
                          v
                  [Carte B : CC1310 recepteur] --UART/XDS110--> [PC]
```

## Contenu du dossier

```
cc1310-rf-dht11/
├── carte-A-emetteur/
│   ├── dht11.h            # Interface du driver DHT11 (inchangee)
│   ├── dht11.c            # Driver DHT11 — CORRIGE (voir "Correctif appliqué" ci-dessous)
│   └── rfEasyLinkTx.c      # Lecture DHT11 + envoi radio + envoi UART de debug
└── carte-B-recepteur/
    └── rfEasyLinkRx.c       # Reception radio + relais vers UART/PC
```

## ⚠️ Prérequis indispensable avant d'utiliser ces fichiers

Ces fichiers sont faits pour être **greffés sur un exemple EasyLink qui compile déjà tel quel** sur tes deux cartes (`rfEasyLinkTx`/`rfEasyLinkRx` du SDK), pas pour créer un projet CCS de zéro. Tu as confirmé que c'est déjà le cas chez toi (LED verte clignotante en TX, LED rouge en RX) — pars bien de **ces deux projets existants**, sans toucher aux fichiers générés par CCS que tu n'as pas dans ce dossier (`.cfg`, `easylink_config.h`, `smartrf_settings.c/h`, fichiers de board).

## Installation

### Carte A (émetteur, celle avec le DHT11)

1. Dans ton projet CCS `rfEasyLinkTx` qui compile déjà : ajoute `dht11.h` et `dht11.c` à la racine du projet (clic droit sur le projet → *Add Files*).
2. Remplace le contenu de ton `rfEasyLinkTx.c` par celui fourni ici.
3. Câblage DHT11 : `VCC → 3.3V`, `GND → GND`, `DATA → DIO24` (broche `IOID_24`).

### Carte B (récepteur, reliée au PC)

1. Dans ton projet CCS `rfEasyLinkRx` qui compile déjà : remplace le contenu de `rfEasyLinkRx.c` par celui fourni ici.
2. Aucun câblage capteur nécessaire sur cette carte — seul le port USB/XDS110 vers le PC est utilisé.

## ✅ Correctif appliqué dans `dht11.c` (par rapport à la version relue précédemment)

```c
PRCMPeripheralRunEnable(PRCM_PERIPH_TIMER0);
PRCMPeripheralSleepEnable(PRCM_PERIPH_TIMER0);      /* ajouté */
PRCMPeripheralDeepSleepEnable(PRCM_PERIPH_TIMER0);  /* ajouté */
PRCMLoadSet();
while (!PRCMLoadGet()) { }
```

Sans ces deux lignes, TI-RTOS peut couper l'horloge du timer GPT0 pendant les
phases de veille automatique entre deux lectures (`Task_sleep`), ce qui aurait
pu se traduire par un premier relevé correct puis des mesures aberrantes ou
des blocages à partir du deuxième cycle. Ce point est documenté dans les
commentaires du fichier.

## Checklist avant de flasher les deux cartes

| Point à vérifier | Où |
|---|---|
| **Même PHY** des deux côtés (`EASYLINK_PARAM_CONFIG` dans `easylink_config.h`) | Fichier généré par CCS, propre à chaque projet — pas dans ce dossier |
| **Même bande de fréquence** (433/868/915 MHz selon ta variante de LaunchPad) | Vérifie l'étiquette/sérigraphie de chaque carte |
| **`RADIO_DST_ADDR` (carte A) = adresse filtrée côté carte B** | `0xAA` par défaut dans `rfEasyLinkTx.c` — la carte B fournie ici ne filtre pas par adresse (elle accepte tout), donc `0xAA` fonctionne tel quel |
| **Une seule carte A active à la fois** sur cette fréquence | La carte B ne filtrant pas par adresse, deux émetteurs simultanés se mélangeraient |

## Format des trames (inchangé de bout en bout)

```
Succes : DATA,<temp>,<hum>\r\n     ex: DATA,23,45\r\n
Erreur : ERR,<message>\r\n
```

Ce format est **identique** à celui que produisait la liaison UART directe
qu'on avait mise en place avant de passer en RF : ton script `dht11_logger.py`
n'a donc **aucune modification à faire**, il faut juste pointer `SERIAL_PORT`
vers le port COM/USB de la **carte B** (celle reliée au PC), plus vers la carte A.

## Rappel de la chaîne complète (déjà construite dans les échanges précédents)

```
Carte A (DHT11) --RF--> Carte B --UART--> dht11_logger.py --HTTP--> telemetry-platform (dashboard)
```

- `dht11_logger.py` : lit le port série de la carte B, journalise en CSV, et
  envoie chaque mesure via `POST /api/ingest` (clé `X-API-Key`).
- `telemetry-platform/` : backend Node.js + dashboard web (authentification,
  rôles, jauges, graphique, alertes).

Aucun changement n'est nécessaire dans ces deux éléments : seul le firmware
change (UART direct → relais RF), le format de trame et l'API restant identiques.

## Test étape par étape recommandé

1. Flashe la carte B, ouvre un terminal série dessus (ex. Tera Term/PuTTY, 115200 8N1) : tu dois voir `ERR,Demarrage carte B (recepteur radio)`.
2. Flashe la carte A : tu dois voir clignoter LED1 à chaque tentative d'envoi.
3. Sur le terminal série de la carte B : tu dois voir apparaître `DATA,xx,xx` toutes les ~2 secondes.
4. Si tu vois `ERR,Pas de reponse du capteur` en boucle : vérifie le câblage DHT11 (DIO24, pas DIO7).
5. Si tu ne vois **rien du tout** côté carte B (pas même les erreurs) : vérifie la checklist RF ci-dessus (PHY, bande, adresse) avant de suspecter le DHT11.
6. Une fois l'étape 3 validée, lance `dht11_logger.py` en pointant sur le port de la carte B, puis le dashboard.
