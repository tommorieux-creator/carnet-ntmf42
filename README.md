# Carnet NTMF 42

Carnet d'entraînement pour le trail NTMF 42 km (25 avril 2027, 1 050 m D+) : programme de 25 semaines
(du 2 novembre 2026 au 25 avril 2027), import des séances GPX/TCX, analyse de pente, prédictions de temps,
nutrition et repas, progression, XP et trophées.

**Ouvrir le carnet :** https://tommorieux-creator.github.io/carnet-ntmf42/

## Installer sur iPhone

1. Ouvrez le lien dans **Safari**.
2. Touchez **Partager**, puis **Sur l'écran d'accueil**, puis **Ajouter**.

Le carnet s'ouvre alors en plein écran, comme une application, et fonctionne hors ligne une fois chargé.
Sur Android, Chrome propose « Installer l'application ».

## Où sont les données

Tout est enregistré **sur l'appareil**, dans le navigateur (IndexedDB). Rien n'est envoyé à un serveur.
Conséquences :

- chaque personne a son propre carnet, vide au départ ;
- les données ne se synchronisent pas entre téléphone et ordinateur ;
- vider les données de Safari efface le carnet : utilisez **Carnet → Données → Tout exporter (JSON)**
  de temps en temps, puis **Restaurer une sauvegarde** sur un autre appareil si besoin
  (les photos et les fichiers GPX d'origine ne sont pas inclus).

## Analyses par l'IA (facultatif)

Les analyses de séances, de repas et de photos utilisent Claude via **votre propre clé d'API** Anthropic :

1. Créez une clé sur [console.anthropic.com](https://console.anthropic.com/settings/keys) et ajoutez un peu de crédit.
2. Collez-la dans **Carnet → Données → Analyses par l'IA**.

La clé reste dans le navigateur, n'est jamais incluse dans les sauvegardes et n'est envoyée qu'à
`api.anthropic.com`. Chaque analyse coûte en général quelques centimes au plus. Sans clé, tout le reste fonctionne.

## Premier lancement

Renseignez **Carnet → Données → Mon profil** (taille, âge, poids, record 10 km, et comment l'IA vous appelle).
Le programme et ses allures sont calibrés pour un coureur autour de 48 min au 10 km visant 4 h 35 sur le 42 km.

## Développement

- `src/` : sources (HTML/CSS, JavaScript par morceaux, `plan.json` = le programme) ;
- `src/web/claude-shim.js` : stockage local et appels à l'API Anthropic ;
- `python3 src/build.py` régénère `index.html` et `sw.js` à la racine.

Modèles utilisés (dans `claude-shim.js`) : `claude-sonnet-5-5` pour les analyses, `claude-haiku-4-5-20251001` pour les réponses courtes.
