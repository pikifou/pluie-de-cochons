const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/logic.js');

function seed(s) { return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

test('55 faits dans les tables de 1 à 10', () => {
  assert.strictEqual(L.toutesLesCles().length, 55);
});

test('les questions restent dans les tables de la coupe', () => {
  for (const cp of L.COUPES) {
    const qs = L.tirerQuestions({}, cp.id, 10, seed(7));
    assert.strictEqual(qs.length, 10);
    for (const q of qs) assert.ok(cp.tables.includes(q.a) || cp.tables.includes(q.b), cp.id + ' ' + q.a + 'x' + q.b);
    const cles = new Set(qs.map(q => L.cle(q.a, q.b)));
    assert.strictEqual(cles.size, 10, 'pas de doublon dans ' + cp.id);
  }
});

test('une course en coupe : erreur = coeur perdu + pénalité + question rejouée', () => {
  const qs = [{ a: 2, b: 3 }, { a: 4, b: 5 }, { a: 10, b: 2 }];
  const c = L.nouvelleCourse({ mode: 'coupe', coupe: 'paille', classe: '50', questions: qs, objectif: 3 });
  const m = {};
  let r = L.repondre(c, 7, 2, m);
  assert.strictEqual(r.v, 'deborde');
  assert.strictEqual(c.coeurs, 2);
  assert.strictEqual(c.temps, 7);
  assert.deepStrictEqual(c.file.map(q => q.a * q.b), [20, 20, 6]);
  L.repondre(c, 20, 3, m); L.repondre(c, 20, 3, m);
  assert.ok(!c.finie);
  r = L.repondre(c, 6, 2, m);
  assert.strictEqual(r.v, 'juste');
  assert.ok(c.finie && !c.perdue);
  assert.strictEqual(c.premierCoup, 2);
});

test('3 erreurs = course perdue', () => {
  const c = L.nouvelleCourse({ mode: 'coupe', questions: [{ a: 3, b: 3 }], objectif: 1 });
  L.repondre(c, 1, 1); L.repondre(c, 1, 1); L.repondre(c, 1, 1);
  assert.ok(c.finie && c.perdue);
});

test('les rivaux sont plus lents en 50cc qu\'en 150cc (par grange) et le classement est trié', () => {
  for (const r of L.RIVAUX) assert.ok(L.tempsParGrange(r, 'boue', '50') > L.tempsParGrange(r, 'boue', '150'));
  const cl = L.classement('gland', '100', 30, 'Joshua');
  for (let i = 1; i < cl.length; i++) assert.ok(cl[i - 1].temps <= cl[i].temps);
  assert.strictEqual(cl.length, 9);
});

test('podium atteignable : un enfant à 4,5 s par grange est sur le podium en 50cc Paille', () => {
  assert.ok(L.place('paille', '50', 4.5 * 3) <= 3);
  // et le loup en 150cc Étoile reste un vrai défi (< 4 s par grange)
  const loup = L.RIVAUX[0];
  assert.ok(L.tempsParGrange(loup, 'etoile', '150') < 4);
});

test('déblocage des coupes', () => {
  const sv = L.nouvelleSauvegarde();
  assert.deepStrictEqual(L.coupesDebloquees(sv), ['paille']);
  const r = L.enregistrer(sv, 'paille', '50', 5);
  assert.strictEqual(r.place, 1);
  assert.deepStrictEqual(r.nouvelles, ['boue']);
  L.enregistrer(sv, 'boue', '50', 5); L.enregistrer(sv, 'gland', '50', 5);
  const r2 = L.enregistrer(sv, 'tracteur', '50', 5);
  assert.deepStrictEqual(r2.nouvelles, ['etoile']);
  // un record moins bon ne remplace pas
  const r3 = L.enregistrer(sv, 'paille', '50', 50);
  assert.ok(!r3.record);
});

test('maîtrise : 3 justes rapides de suite = étoile', () => {
  const m = {};
  L.noter(m, 7, 8, false, 9);
  assert.strictEqual(L.niveau(m['7x8']), 1);
  L.noter(m, 8, 7, true, 6);
  assert.strictEqual(L.niveau(m['7x8']), 2);
  L.noter(m, 7, 8, true, 5);
  assert.strictEqual(L.niveau(m['7x8']), 3);
  L.noter(m, 7, 8, true, 3.5);
  assert.strictEqual(L.niveau(m['7x8']), 4);
});

test('entraînement : toute la table, sans perdre de coeur', () => {
  const qs = L.questionsEntrainement(7, seed(3));
  assert.strictEqual(qs.length, 10);
  const c = L.nouvelleCourse({ mode: 'entrainement', table: 7, questions: qs });
  L.repondre(c, 0, 2);
  assert.strictEqual(c.coeurs, 3);
  assert.strictEqual(c.file.length, 10);
});
