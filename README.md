# Pluie de Cochons

Jeu pour apprendre les tables de multiplication, en trois modes : Apprendre (une astuce par table et des flash cards expliquées), Entraînement (une table à la fois, chrono et record) et Défi (coupes façon kart en 50, 100 et 150cc contre 8 rivaux, 3 cœurs). Dans la grange, on tape sa réponse et autant de cochons tombent du ciel : il en manque, c'est juste, ou ça déborde.

- Jouer / installer : https://pikifou.github.io/pluie-de-cochons/
- Android (Chrome) : bouton « Installer » sur l'écran titre.
- iPhone (Safari) : Partager → « Sur l'écran d'accueil ».

## Développement
- Sources dans `src/`, médias dans `assets/`, appli construite dans `docs/` (GitHub Pages, branche `main`, dossier `/docs`).
- `python3 build.py --pwa docs` reconstruit l'appli ; `python3 build.py` produit un `index.html` autonome.
- `node --test tests/logic.test.js` ; `python3 tests/perf.py <fichier.html>` mesure la fluidité sur un téléphone simulé.
