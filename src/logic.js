// Pluie de Cochons : logique pure (coupes, rivaux, maîtrise, choix des questions).
// Pas de DOM ici : testable sous node (node --test tests/logic.test.js).
(function (root) {
'use strict';

// ---------- Classes (comme les cylindrées de Mario Kart) ----------
const CLASSES = [
  { id: '50',  nom: '50cc',  granges: 3,  facteur: 1.40 },
  { id: '100', nom: '100cc', granges: 5,  facteur: 1.15 },
  { id: '150', nom: '150cc', granges: 10, facteur: 1.00 },
];

// ---------- Coupes ----------
// tables : les tables travaillées. dur : rend les rivaux plus lents (tables difficiles).
const COUPES = [
  { id: 'paille',   nom: 'Coupe Paille',   tables: [1, 2, 10], dur: 0.85, couleur: '#ffe066' },
  { id: 'boue',     nom: 'Coupe Boue',     tables: [3, 4, 5],  dur: 1.00, couleur: '#c98a4b' },
  { id: 'gland',    nom: 'Coupe Gland',    tables: [6, 7],     dur: 1.15, couleur: '#7dff6a' },
  { id: 'tracteur', nom: 'Coupe Tracteur', tables: [8, 9],     dur: 1.20, couleur: '#ff5c8a' },
  { id: 'etoile',   nom: 'Coupe Étoile',   tables: [2, 3, 4, 5, 6, 7, 8, 9], dur: 1.30, couleur: '#4df3ff', speciale: true },
];

// ---------- Rivaux (les faux profils à battre) ----------
// base : secondes par grange en 150cc sur une coupe de difficulté 1.
// gout : petites préférences par coupe (le lapin aime les tables faciles, le hibou les dures...).
const RIVAUX = [
  { id: 'loup',     nom: 'Loulou',     base: 3.0, gout: { paille: 1.05, boue: 1.0,  gland: 0.97, tracteur: 0.97, etoile: 0.96 }, couleur: '#ff4d4d' },
  { id: 'hibou',    nom: 'Hubert',     base: 3.6, gout: { paille: 1.15, boue: 1.05, gland: 0.95, tracteur: 0.9,  etoile: 0.92 }, couleur: '#c9945a' },
  { id: 'renard',   nom: 'Rapido',     base: 4.3, gout: { paille: 0.9,  boue: 0.95, gland: 1.05, tracteur: 1.05, etoile: 1.0 },  couleur: '#ff9a3c' },
  { id: 'vache',    nom: 'Margot',     base: 5.2, gout: { paille: 1.0,  boue: 0.95, gland: 1.0,  tracteur: 1.05, etoile: 1.0 },  couleur: '#9be7ff' },
  { id: 'lapin',    nom: 'Lapinou',    base: 6.2, gout: { paille: 0.8,  boue: 0.95, gland: 1.1,  tracteur: 1.15, etoile: 1.1 },  couleur: '#d98bff' },
  { id: 'coq',      nom: 'Cocorico',   base: 7.5, gout: { paille: 0.95, boue: 1.0,  gland: 1.0,  tracteur: 0.95, etoile: 1.0 },  couleur: '#ffd23f' },
  { id: 'chevre',   nom: 'Biquette',   base: 9.0, gout: { paille: 1.0,  boue: 1.05, gland: 0.95, tracteur: 1.0,  etoile: 1.05 }, couleur: '#ffffff' },
  { id: 'tracteur', nom: 'Trac-Trac',  base: 11.5, gout: { paille: 1.0, boue: 1.0,  gland: 1.0,  tracteur: 0.9,  etoile: 1.0 },  couleur: '#6aff8f' },
];

const PENALITE = 5;      // secondes ajoutées par erreur
const COEURS = 3;

function classe(id) { return CLASSES.find(c => c.id === id) || CLASSES[0]; }
function coupe(id) { return COUPES.find(c => c.id === id) || COUPES[0]; }

// Temps par grange d'un rival pour une coupe et une classe.
function tempsParGrange(rival, coupeId, classeId) {
  const cp = coupe(coupeId), cl = classe(classeId);
  return rival.base * cp.dur * cl.facteur * (rival.gout[coupeId] || 1);
}
function tempsRival(rival, coupeId, classeId) {
  const t = tempsParGrange(rival, coupeId, classeId) * classe(classeId).granges;
  return Math.round(t * 10) / 10;
}

// Classement : rivaux + joueur (temps null = pas encore de temps).
function classement(coupeId, classeId, tempsJoueur, nomJoueur) {
  const lignes = RIVAUX.map(r => ({ id: r.id, nom: r.nom, temps: tempsRival(r, coupeId, classeId), joueur: false }));
  if (tempsJoueur != null) lignes.push({ id: 'joueur', nom: nomJoueur || 'Toi', temps: tempsJoueur, joueur: true });
  // à égalité, le joueur passe devant (c'est lui qui joue !)
  lignes.sort((a, b) => a.temps - b.temps || (b.joueur ? 1 : 0) - (a.joueur ? 1 : 0));
  return lignes;
}
function place(coupeId, classeId, tempsJoueur) {
  const l = classement(coupeId, classeId, tempsJoueur, 'x');
  return l.findIndex(x => x.joueur) + 1;
}
// 1 = or, 2 = argent, 3 = bronze, 0 = rien
function trophee(p) { return p >= 1 && p <= 3 ? p : 0; }

// ---------- Maîtrise des tables ----------
function cle(a, b) { return Math.min(a, b) + 'x' + Math.max(a, b); }

// niveau : 0 jamais vu, 1 raté la dernière fois, 2 trouvé, 3 connu, 4 étoile (connu et rapide)
function niveau(st) {
  if (!st || !st.n) return 0;
  if (!st.dernier) return 1;
  if (st.serie >= 3 && st.meilleur != null && st.meilleur <= 4) return 4;
  if (st.serie >= 2 && st.meilleur != null && st.meilleur <= 7) return 3;
  return 2;
}

function noter(maitrise, a, b, juste, secondes) {
  const k = cle(a, b);
  const st = maitrise[k] || { n: 0, ok: 0, serie: 0, meilleur: null, dernier: false };
  st.n++;
  st.dernier = !!juste;
  if (juste) {
    st.ok++;
    st.serie++;
    if (secondes != null && (st.meilleur == null || secondes < st.meilleur)) st.meilleur = Math.round(secondes * 10) / 10;
  } else {
    st.serie = 0;
  }
  maitrise[k] = st;
  return st;
}

function toutesLesCles() {
  const l = [];
  for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) l.push(cle(a, b));
  return l; // 55 faits
}
function bilan(maitrise) {
  const cles = toutesLesCles();
  let connus = 0, etoiles = 0, vus = 0;
  for (const k of cles) {
    const n = niveau(maitrise[k]);
    if (n > 0) vus++;
    if (n >= 3) connus++;
    if (n >= 4) etoiles++;
  }
  return { total: cles.length, vus, connus, etoiles };
}
// Une table est « connue » quand tous ses faits sont au niveau 3 ou plus.
function tableConnue(maitrise, t) {
  for (let x = 1; x <= 10; x++) if (niveau(maitrise[cle(t, x)]) < 3) return false;
  return true;
}

// ---------- Choix des questions ----------
function candidats(coupeId) {
  const cp = coupe(coupeId);
  const vus = new Set(), l = [];
  for (const t of cp.tables) {
    for (let x = 1; x <= 10; x++) {
      if (cp.speciale && x < 2) continue;           // la coupe Étoile oublie les x1
      const k = cle(t, x);
      if (vus.has(k)) continue;
      vus.add(k);
      l.push([t, x]);
    }
  }
  return l;
}

function poids(maitrise, a, b, speciale) {
  const n = niveau(maitrise[cle(a, b)]);
  let w = [3, 5, 3, 1.4, 0.6][n];
  if (a === 1 || b === 1) w *= 0.35;               // les x1 sont faciles : on en met peu
  if (a === 10 || b === 10) w *= 0.7;
  if (speciale) w *= 0.6 + (Math.min(a, b) >= 6 ? 0.8 : 0) + (a * b >= 30 ? 0.4 : 0);
  return w;
}

// rand : fonction () => [0,1) ; renvoie une liste de questions {a (colonnes), b (lignes)}
function tirerQuestions(maitrise, coupeId, nb, rand) {
  rand = rand || Math.random;
  const cp = coupe(coupeId);
  let pool = candidats(coupeId).map(([a, b]) => ({ a, b, w: poids(maitrise, a, b, cp.speciale) }));
  const res = [];
  while (res.length < nb) {
    if (!pool.length) pool = candidats(coupeId).map(([a, b]) => ({ a, b, w: 1 }));
    const tot = pool.reduce((s, q) => s + q.w, 0);
    let r = rand() * tot, i = 0;
    while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; }
    const q = pool.splice(i, 1)[0];
    // on tourne la grange au hasard : 4 x 6 ou 6 x 4, c'est pareil (commutativité)
    if (rand() < 0.5) res.push({ a: q.a, b: q.b }); else res.push({ a: q.b, b: q.a });
  }
  return res;
}

function questionsEntrainement(t, rand) {
  rand = rand || Math.random;
  const l = [];
  for (let x = 1; x <= 10; x++) l.push(rand() < 0.5 ? { a: t, b: x } : { a: x, b: t });
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

// ---------- Déroulé d'une course (sans rendu) ----------
// mode 'coupe' : il faut N granges justes, 3 coeurs, chrono.
// mode 'entrainement' : la liste entière, pas de coeur perdu, pas de chrono.
function nouvelleCourse(opts) {
  return {
    mode: opts.mode || 'coupe',
    coupe: opts.coupe || null,
    classe: opts.classe || null,
    table: opts.table || null,
    file: opts.questions.slice(),
    objectif: opts.objectif || opts.questions.length,
    justes: 0,
    erreurs: 0,
    premierCoup: 0,
    coeurs: COEURS,
    temps: 0,        // secondes de réflexion
    penalites: 0,
    finie: false,
    perdue: false,
    rates: new Set(),
  };
}
function questionCourante(c) { return c.file[0] || null; }

// Résultat de la réponse : 'juste' | 'manque' | 'deborde'
function verdict(q, rep) { const p = q.a * q.b; return rep === p ? 'juste' : rep < p ? 'manque' : 'deborde'; }

function repondre(c, rep, secondes, maitrise) {
  const q = c.file.shift();
  const v = verdict(q, rep);
  const juste = v === 'juste';
  if (c.mode === 'coupe') c.temps += secondes;
  if (maitrise) noter(maitrise, q.a, q.b, juste, secondes);
  const k = cle(q.a, q.b);
  if (juste) {
    c.justes++;
    if (!c.rates.has(k)) c.premierCoup++;
  } else {
    c.erreurs++;
    c.rates.add(k);
    if (c.mode === 'coupe') { c.coeurs--; c.temps += PENALITE; c.penalites += PENALITE; }
    // la grange ratée revient un peu plus tard, tournée dans l'autre sens
    const pos = Math.min(2, c.file.length);
    c.file.splice(pos, 0, { a: q.b, b: q.a, rejouee: true });
  }
  if (c.mode === 'coupe') {
    if (c.coeurs <= 0) { c.finie = true; c.perdue = true; }
    else if (c.justes >= c.objectif) c.finie = true;
    // en coupe la file peut s'épuiser si beaucoup de justes : on ne garde que l'objectif
  } else {
    if (!c.file.length) c.finie = true;
  }
  c.temps = Math.round(c.temps * 100) / 100;
  return { q, v, juste };
}

// ---------- Sauvegarde ----------
function nouvelleSauvegarde() {
  return {
    v: 1,
    nom: 'Joshua',
    maitrise: {},
    records: {},     // 'coupe:classe' -> { temps, place }
    debloquees: ['paille'],
    musique: 0.7,
    bruitages: 1,
    classe: '50',
    vuesDeblocage: [],
  };
}
function cleRecord(coupeId, classeId) { return coupeId + ':' + classeId; }

// Une coupe se débloque quand la précédente a un trophée (n'importe quelle classe).
// La coupe Étoile demande un trophée dans les 4 premières.
function coupesDebloquees(sv) {
  const l = ['paille'];
  const aTrophee = id => CLASSES.some(cl => { const r = sv.records[cleRecord(id, cl.id)]; return r && trophee(r.place); });
  for (let i = 1; i < COUPES.length; i++) {
    const cp = COUPES[i];
    if (cp.speciale) { if (COUPES.slice(0, i).every(x => aTrophee(x.id))) l.push(cp.id); }
    else if (aTrophee(COUPES[i - 1].id)) l.push(cp.id);
  }
  return l;
}

// Enregistre le résultat d'une coupe. Renvoie { place, record (nouveau record ?), nouvelles (coupes débloquées) }
function enregistrer(sv, coupeId, classeId, temps) {
  const avant = coupesDebloquees(sv);
  const p = place(coupeId, classeId, temps);
  const k = cleRecord(coupeId, classeId);
  const ancien = sv.records[k];
  const record = !ancien || temps < ancien.temps;
  if (record) sv.records[k] = { temps, place: p };
  const apres = coupesDebloquees(sv);
  const nouvelles = apres.filter(x => !avant.includes(x));
  return { place: p, record, ancien: ancien ? ancien.temps : null, nouvelles };
}

function meilleurTrophee(sv, coupeId, classeId) {
  const r = sv.records[cleRecord(coupeId, classeId)];
  return r ? trophee(r.place) : 0;
}

// ---------- Astuces (mode flash cards) ----------
const ASTUCES_TABLE = {
  1:  { titre: 'Fois 1 : rien ne change', lignes: ['Un seul groupe, c\'est le nombre lui-même.', '1 × 7 = 7'] },
  2:  { titre: 'Fois 2 : le double', lignes: ['On ajoute le nombre à lui-même.', '2 × 7 = 7 + 7 = 14'] },
  3:  { titre: 'Fois 3 : le double, plus une fois', lignes: ['Fais le double, puis ajoute encore le nombre.', '3 × 7 = 14 + 7 = 21'] },
  4:  { titre: 'Fois 4 : le double du double', lignes: ['Double une fois, puis encore une fois.', '4 × 7 : 7 → 14 → 28'] },
  5:  { titre: 'Fois 5 : la moitié de fois 10', lignes: ['Fais fois 10, puis prends la moitié.', '5 × 8 : 80, la moitié = 40', 'Ça finit toujours par 0 ou par 5.'] },
  6:  { titre: 'Fois 6 : fois 5, plus une fois', lignes: ['Fais fois 5, puis ajoute le nombre.', '6 × 7 = 35 + 7 = 42'] },
  7:  { titre: 'Fois 7 : fois 5, plus fois 2', lignes: ['Fais fois 5, puis ajoute le double.', '7 × 6 = 30 + 12 = 42', 'À retenir : 7 × 7 = 49 et 7 × 8 = 56.'] },
  8:  { titre: 'Fois 8 : double, double, double', lignes: ['Double trois fois de suite.', '8 × 6 : 6 → 12 → 24 → 48'] },
  9:  { titre: 'Fois 9 : fois 10, moins une fois', lignes: ['Fais fois 10, puis enlève le nombre.', '9 × 7 = 70 − 7 = 63', 'Vérifie : les chiffres font 9 (6 + 3).'] },
  10: { titre: 'Fois 10 : on ajoute un zéro', lignes: ['Le nombre, puis un zéro au bout.', '10 × 7 = 70'] },
};
const ORDRE_ASTUCES = [1, 10, 2, 5, 9, 4, 3, 6, 8, 7]; // de la plus facile à la plus longue
const MEMOS = {
  '7x8': '5, 6, 7, 8 : 56 = 7 × 8 !',
  '8x8': '64, comme les cases d\'un échiquier.',
  '7x7': '49, juste avant 50.',
  '6x8': '48 : presque 50, il manque 2.',
  '6x7': '42 : la table de 6 et de 7 se croisent ici.',
};
// Découpe de la grille pour le dessin : groupes de rangées (de n cochons)
const DECOUPE = { 1: [1], 2: [1, 1], 3: [2, 1], 4: [2, 2], 5: [5], 6: [5, 1], 7: [5, 2], 8: [4, 4], 9: [10], 10: [10] };  // 9 : 10 rangées dont une qu'on enlève

// Explication pour une multiplication : on prend la table la plus facile des deux
function astuce(a, b) {
  const t = ORDRE_ASTUCES.find(x => x === a || x === b);
  const n = t === a ? b : a;
  const r = a * b;
  let titre, calcul;
  switch (t) {
    case 1:  titre = 'Fois 1, rien ne change'; calcul = `${n} × 1 = ${n}`; break;
    case 10: titre = 'Fois 10 : on ajoute un zéro'; calcul = `${n} → ${r}`; break;
    case 2:  titre = 'Le double'; calcul = `${n} + ${n} = ${r}`; break;
    case 3:  titre = 'Le double, plus une fois'; calcul = `${2 * n} + ${n} = ${r}`; break;
    case 4:  titre = 'Le double du double'; calcul = `${n} → ${2 * n} → ${r}`; break;
    case 5:  titre = 'La moitié de fois 10'; calcul = `${n * 10}, la moitié = ${r}`; break;
    case 6:  titre = 'Fois 5, plus une fois'; calcul = `${5 * n} + ${n} = ${r}`; break;
    case 7:  titre = 'Fois 5, plus fois 2'; calcul = `${5 * n} + ${2 * n} = ${r}`; break;
    case 8:  titre = 'Double, double, double'; calcul = `${n} → ${2 * n} → ${4 * n} → ${r}`; break;
    case 9:  titre = 'Fois 10, moins une fois'; calcul = `${10 * n} − ${n} = ${r}`; break;
  }
  const lignes = [];
  if (t === 9 && r >= 10) lignes.push(`Les chiffres font 9 : ${String(r)[0]} + ${String(r)[1]} = 9`);
  const memo = MEMOS[cle(a, b)];
  if (memo) lignes.push(memo);
  if (a !== b && t !== 1 && t !== 10 && n !== 1 && n !== 10) lignes.push(`${a} × ${b} = ${b} × ${a} : on prend la table de ${t}.`);
  const groupes = DECOUPE[t].map(rangs => ({ rangs, total: rangs * n }));
  return { t, n, resultat: r, titre, calcul, lignes, groupes, retire: t === 9 ? 1 : 0 };
}

// Paquet de cartes : une table, ou les 10 multiplications les moins bien sues
function paquet(maitrise, table, rand) {
  rand = rand || Math.random;
  let l;
  if (table) {
    l = [];
    for (let x = 1; x <= 10; x++) l.push(rand() < 0.5 ? { a: table, b: x } : { a: x, b: table });
  } else {
    const tous = [];
    for (let a = 2; a <= 9; a++) for (let b = a; b <= 9; b++) {
      const n = niveau(maitrise[cle(a, b)]);
      tous.push({ a, b, score: [2, 0, 3, 5, 7][n] + rand() * 2.5 - (a * b >= 30 ? 0.8 : 0) });
    }
    tous.sort((x, y) => x.score - y.score);
    l = tous.slice(0, 10).map(q => rand() < 0.5 ? { a: q.a, b: q.b } : { a: q.b, b: q.a });
  }
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

const API = {
  ASTUCES_TABLE, astuce, paquet,
  CLASSES, COUPES, RIVAUX, PENALITE, COEURS,
  classe, coupe, tempsParGrange, tempsRival, classement, place, trophee,
  cle, niveau, noter, toutesLesCles, bilan, tableConnue,
  candidats, tirerQuestions, questionsEntrainement,
  nouvelleCourse, questionCourante, verdict, repondre,
  nouvelleSauvegarde, cleRecord, coupesDebloquees, enregistrer, meilleurTrophee,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.L = API;
})(typeof window !== 'undefined' ? window : globalThis);
