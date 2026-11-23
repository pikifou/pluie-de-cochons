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
- Le son : musique, bruitages (avec les exclamations enregistrées) et voix qui lit les astuces, tous allumés au départ. C'est le kit Ludiworld qui les règle (`Ludi.onSon`) ; les trois boutons de l'écran titre changent le réglage de toute la maison (`Ludi.reglerSon`). Le son n'est plus gardé dans la sauvegarde du jeu.
- Le conseil avant de jouer : le jeu compte les paquets de cartes finis par table (Apprendre montre « ✓ 2 fois ») et les entraînements. Lancer l'entraînement d'une table jamais apprise, ou une course sans avoir appris ou sans s'être entraîné sur ses tables pas encore connues, ouvre un conseil (`L.conseil`) : aller apprendre, ou s'entraîner, ou y aller quand même. Jamais bloquant ; une coupe déjà gagnée ne demande rien.
- `node --test tests/logic.test.js` ; `python tests/conseils.py [captures]` vérifie le conseil en touchant les vrais boutons ; `python tests/histoire.py <captures> [url de docs/ servi en http]` parcourt l'intro, la fin et la marque « Fini » ; `python3 tests/perf.py <fichier.html>` mesure la fluidité sur un téléphone simulé ; `python tests/son.py [captures]` vérifie le son (tout allumé au départ, chaque bouton, le message du launcher, une vieille sauvegarde muette).
