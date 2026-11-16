# Pluie de Cochons

Jeu pour apprendre les tables de multiplication, en trois modes : Apprendre (une astuce par table et des flash cards expliquées), Entraînement (une table à la fois, chrono et record) et Défi (coupes façon kart en 50, 100 et 150cc contre 8 rivaux, 3 cœurs). Dans la grange, on tape sa réponse et autant de cochons tombent du ciel : il en manque, c'est juste, ou ça déborde.

- Jouer / installer : https://pikifou.github.io/pluie-de-cochons/
- Android (Chrome) : bouton « Installer » sur l'écran titre.
- iPhone (Safari) : Partager → « Sur l'écran d'accueil ».

## Développement
- Sources dans `src/`, médias dans `assets/`, appli construite dans `docs/` (GitHub Pages, branche `main`, dossier `/docs`).
- `python3 build.py --pwa docs` reconstruit l'appli ; `python3 build.py` produit un `index.html` autonome.
- Ludiworld : `ludi.json` (la fiche du jeu) est copiée par le build à la racine du site ; `src/ludi.js` est le kit Ludiworld, copié tel quel depuis https://pikifou.github.io/ludiworld/kit/ludi.js. Ouvert seul, le jeu ne change pas.
- L'histoire : une intro la première fois qu'on choisit un mode, une fin la première fois que la Coupe Étoile a un trophée (puis la marque « Fini » et les coupes d'or sur l'écran titre). Images dans `assets/histoire/`, petites vidéos dans `assets/cine/` (seulement dans la version installée).
- `node --test tests/logic.test.js` ; `python tests/histoire.py <captures> [url de docs/ servi en http]` parcourt l'intro, la fin et la marque « Fini » ; `python3 tests/perf.py <fichier.html>` mesure la fluidité sur un téléphone simulé.
