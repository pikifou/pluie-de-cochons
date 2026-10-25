// Pluie de Cochons : écrans, course, rendu.
(function () {
'use strict';
const L = window.L, G = window.Gfx, S = window.Son, C = G.C;
const cv = document.getElementById('jeu');
const ctx = cv.getContext('2d');

let W = 1280, H = 720, ECH = 1, PORTRAIT = false;
let temps = 0;
let boutons = [];
let appui = null;          // { id, t } pour l'effet d'appui
let secousse = 0, flash = 0, flashCouleur = '#fff';
let installEvt = null;

// ---------- Sauvegarde ----------
const CLE = 'pluie-de-cochons.v1';
let sv = L.nouvelleSauvegarde();
function charger() {
  try { const s = JSON.parse(localStorage.getItem(CLE) || 'null'); if (s && s.v === 1) sv = Object.assign(L.nouvelleSauvegarde(), s); } catch (e) {}
  S.volMusique = sv.musique; S.volBruitages = sv.bruitages;
}
function sauver() { try { localStorage.setItem(CLE, JSON.stringify(sv)); } catch (e) {} }

// ---------- Utilitaires ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function fmt(s) {
  if (s == null) return '--';
  if (s >= 60) { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1).replace('.', ',') ; }
  return s.toFixed(1).replace('.', ',') + ' s';
}
const ordinal = n => n === 1 ? '1er' : n + 'e';
const rival = id => L.RIVAUX.find(r => r.id === id);
const couleurPlace = p => p === 1 ? '#ffd23f' : p === 2 ? '#dfe8f5' : p === 3 ? '#ff9d5c' : '#ffffff';

// ---------- Écrans ----------
let ecran = 'titre', tEcran = 0;
function aller(e) {
  if (e === ecran) return;
  if (ecran === 'titre') { try { history.pushState({ e }, ''); } catch (x) {} }
  ecran = e; tEcran = 0;
  S.sfx('whoosh');
  G.grille.choc(W / 2, H / 2, 260, Math.max(W, H));
  if (e === 'course') S.jouerMusique('course'); else S.jouerMusique('menu');
}
function parent() {
  switch (ecran) {
    case 'coupes': case 'tables': case 'astuces': return 'titre';
    case 'cartes': return 'astuces';
    case 'depart': return 'coupes';
    case 'resultats': return FIN && FIN.mode === 'entrainement' ? 'tables' : 'coupes';
    default: return 'titre';
  }
}
// bouton Retour (écran) ou retour Android
function retour(depuisHistorique) {
  if (ecran === 'course') {
    if (R) R.pauseMenu = !R.pauseMenu;
  } else if (ecran !== 'titre') {
    ecran = parent(); tEcran = 0; S.sfx('whoosh'); S.jouerMusique('menu');
  }
  if (depuisHistorique && ecran !== 'titre') { try { history.pushState({ e: ecran }, ''); } catch (x) {} }
}
window.addEventListener('popstate', () => retour(true));

// ---------- Boutons (immédiats) ----------
function bouton(id, x, y, w, h, o, action) {
  o = o || {};
  const actif = !o.desactive;
  boutons.push({ id, x, y, w, h, action: actif ? action : null });
  const enfonce = appui && appui.id === id && temps - appui.t < 0.15;
  const k = enfonce ? 0.93 : 1;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k);
  const coul = actif ? (o.couleur || C.cyan) : '#3a4180';
  const fond = o.fond || (actif ? 'rgba(10,16,60,0.85)' : 'rgba(10,12,40,0.6)');
  G.rectNeon(ctx, -w / 2, -h / 2, w, h, coul, { fond, flou: actif ? (o.flou != null ? o.flou : 16) : 0, epaisseur: o.epaisseur || 3, coin: Math.min(12, h / 4) });
  if (o.dessin) o.dessin(ctx, w, h, actif);
  if (o.texte != null) G.texte(ctx, o.texte, o.dx || 0, o.dy || 0, o.taille || h * 0.42, actif ? (o.couleurTexte || '#fff') : '#5b63a8', { police: o.police || 'texte', lueur: actif ? coul : null, flou: 8 });
  if (o.sous) G.texte(ctx, o.sous, 0, h * 0.28, o.tailleSous || h * 0.18, actif ? '#bcd' : '#5b63a8', {});
  ctx.restore();
}

// ---------- Fond commun ----------
const etoiles = [];
for (let i = 0; i < 90; i++) etoiles.push({ x: Math.random(), y: Math.random(), s: Math.random() < 0.15 ? 3 : 2, p: Math.random() * 6, c: Math.random() < 0.3 ? C.rosePale : '#cfe' });
// Le dégradé et les étoiles fixes sont dessinés une fois dans une image ; seules quelques étoiles scintillent.
let fondCache = null;
function fond(dt) {
  if (!fondCache || fondCache.width !== cv.width || fondCache.height !== cv.height) {
    fondCache = document.createElement('canvas'); fondCache.width = cv.width; fondCache.height = cv.height;
    const f = fondCache.getContext('2d'); f.setTransform(ECH, 0, 0, ECH, 0, 0);
    const g = f.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05061a'); g.addColorStop(0.55, '#0b0f3a'); g.addColorStop(1, '#16114a');
    f.fillStyle = g; f.fillRect(0, 0, W, H);
    etoiles.forEach((e, i) => { if (i % 4) { f.globalAlpha = 0.5; f.fillStyle = e.c; f.fillRect(e.x * W, e.y * H, e.s, e.s); } });
  }
  ctx.drawImage(fondCache, 0, 0, W, H);
  for (let i = 0; i < etoiles.length; i += 4) {
    const e = etoiles[i];
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(temps * 2 + e.p);
    ctx.fillStyle = e.c; ctx.fillRect(e.x * W, e.y * H, e.s, e.s);
  }
  ctx.globalAlpha = 1;
  G.grille.dessiner(ctx, 'rgba(70,110,255,0.20)', temps);
}

// ---------- Pluie de cochons décorative (menus) ----------
const deco = [];
function decoMaj(dt, dense) {
  if (Math.random() < dt * (dense ? 4 : 1.6)) {
    const s = 26 + Math.random() * 30;
    deco.push({ x: Math.random() * W, y: -60, vy: 60 + Math.random() * 80, vx: (Math.random() - 0.5) * 40, r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s, rebonds: 0 });
  }
  for (let i = deco.length - 1; i >= 0; i--) {
    const d = deco[i];
    d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt;
    if (d.y > H - 30 && d.vy > 0 && d.rebonds < 1) { d.vy *= -0.45; d.vx *= 2; d.vr *= 2; d.rebonds++; G.grille.choc(d.x, H - 30, 90, 140); }
    if (d.y > H + 80) deco.splice(i, 1);
  }
}
function decoDessin() {
  for (const d of deco) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.r);
    G.dessiner(ctx, G.cochons.normal, -d.s / 2, -d.s / 2, d.s, d.s * 13 / 14, 0.85);
    ctx.restore();
  }
}

// ---------- Icônes son ----------
function iconeMusique(c, w, h, actif) {
  const s = h * 0.06; c.fillStyle = actif && S.volMusique > 0 ? '#fff' : '#5b63a8';
  c.fillRect(-s * 2, -s * 5, s * 6, s * 1.5); c.fillRect(-s * 2, -s * 5, s * 1.4, s * 8); c.fillRect(s * 3, -s * 5, s * 1.4, s * 6.5);
  c.fillRect(-s * 4.4, s * 2, s * 3.6, s * 2.6); c.fillRect(s * 0.6, s * 0.5, s * 3.6, s * 2.6);
  if (S.volMusique <= 0) { c.strokeStyle = C.rouge; c.lineWidth = 4; c.beginPath(); c.moveTo(-w * 0.3, -h * 0.3); c.lineTo(w * 0.3, h * 0.3); c.stroke(); }
}
function iconeHP(c, w, h) {
  const s = h * 0.07; c.fillStyle = S.volBruitages > 0 ? '#fff' : '#5b63a8';
  c.fillRect(-s * 5, -s * 2, s * 3, s * 4);
  c.beginPath(); c.moveTo(-s * 2, -s * 2); c.lineTo(s * 1.5, -s * 5); c.lineTo(s * 1.5, s * 5); c.lineTo(-s * 2, s * 2); c.fill();
  if (S.volBruitages > 0) { c.fillRect(s * 3, -s * 2, s, s * 4); c.fillRect(s * 5, -s * 4, s, s * 8); }
  else { c.strokeStyle = C.rouge; c.lineWidth = 4; c.beginPath(); c.moveTo(-w * 0.3, -h * 0.3); c.lineTo(w * 0.3, h * 0.3); c.stroke(); }
}
function boutonsSon(x, y, t) {
  bouton('musique', x, y, t, t, { couleur: C.violet, dessin: iconeMusique }, () => { sv.musique = sv.musique > 0 ? 0 : 0.7; S.volMusique = sv.musique; S.appliquerVolumes(); sauver(); });
  bouton('hp', x + t + 12, y, t, t, { couleur: C.violet, dessin: iconeHP }, () => { sv.bruitages = sv.bruitages > 0 ? 0 : 1; S.volBruitages = sv.bruitages; S.appliquerVolumes(); sauver(); S.sfx('clic'); });
}
function boutonRetour(x, y) {
  bouton('retour', x, y, 120, 56, { texte: '< Retour', taille: 24, couleur: C.violet }, () => retour(false));
}

// =====================================================================
// ÉCRAN TITRE
// =====================================================================
let bienvenueDite = false;
function ecranTitre(dt) {
  decoMaj(dt, true); decoDessin();
  const cx = W / 2;
  const tl = Math.min(W / 9.5, PORTRAIT ? 92 : 104);
  const yLogo = PORTRAIT ? H * 0.2 : H * 0.2;
  // logo
  const haut = 'PLUIE DE';
  G.texteFige(ctx, haut, cx, yLogo - tl * 0.95, tl * 0.42, C.cyan, { police: 'titre', contour: '#0a0430', lueur: C.cyan });
  const mot = 'COCHONS';
  ctx.font = G.police('titre', tl);
  const lw = ctx.measureText(mot).width;
  let x = cx - lw / 2;
  for (let i = 0; i < mot.length; i++) {
    const ch = mot[i], w = ctx.measureText(ch).width;
    const dy = Math.sin(temps * 4 + i * 0.7) * tl * 0.08;
    G.texteFige(ctx, ch, x + w / 2, yLogo + dy, tl, i % 2 ? '#ff8ec4' : C.rose, { police: 'titre', contour: '#2a0420', lueur: C.rose, epaisseur: tl * 0.14 });
    x += w;
  }
  G.texteFige(ctx, 'Les tables de multiplication', cx, yLogo + tl * 0.95, Math.min(34, W / 20), C.jaune, { lueur: C.jaune, flou: 10 });

  // héros + prénom
  const ps = PORTRAIT ? 150 : 128;
  const py = PORTRAIT ? H * 0.36 : H * 0.36;
  const bob = Math.sin(temps * 3) * 6;
  ctx.save(); ctx.shadowColor = C.rose; ctx.shadowBlur = 30;
  G.portrait(ctx, 'heros', cx - ps / 2, py + bob, ps);
  ctx.restore();
  const nomY = py + ps + 34;
  bouton('nom', cx - 150, nomY - 28, 300, 56, { texte: sv.nom + '  ✎', taille: 30, couleur: C.rose }, () => editerNom());

  // progression
  const b = L.bilan(sv.maitrise);
  const by = nomY + 60;
  const bw = Math.min(460, W * 0.8);
  ctx.fillStyle = 'rgba(20,26,82,0.9)'; ctx.fillRect(cx - bw / 2, by, bw, 20);
  ctx.fillStyle = C.vert; ctx.shadowColor = C.vert; ctx.shadowBlur = 12;
  ctx.fillRect(cx - bw / 2, by, bw * b.connus / b.total, 20); ctx.shadowBlur = 0;
  G.rectNeon(ctx, cx - bw / 2, by, bw, 20, C.vert, { flou: 6, epaisseur: 2, coins: false });
  G.texte(ctx, `${b.connus} / ${b.total} multiplications connues`, cx, by + 42, 24, '#dff', {});

  // boutons
  const bw2 = Math.min(420, W * 0.8), bh = PORTRAIT ? 96 : 84;
  const y1 = PORTRAIT ? H * 0.68 : by + 80;
  bouton('jouer', cx - bw2 / 2, y1, bw2, bh, { texte: 'JOUER', taille: bh * 0.42, police: 'titre', couleur: C.jaune, flou: 24 + Math.sin(temps * 5) * 8 }, () => {
    if (!bienvenueDite) { bienvenueDite = true; }
    allerPleinEcran();
    aller('coupes');
  });
  const bw3 = (bw2 - 16) / 2;
  bouton('tables', cx - bw2 / 2, y1 + bh + 18, bw3, bh * 0.78, { texte: 'MES TABLES', taille: Math.min(bh * 0.24, bw3 / 11), police: 'titre', couleur: C.cyan }, () => aller('tables'));
  bouton('astuces', cx + 8, y1 + bh + 18, bw3, bh * 0.78, { texte: 'ASTUCES', taille: Math.min(bh * 0.24, bw3 / 8), police: 'titre', couleur: C.violet }, () => aller('astuces'));

  boutonsSon(20, H - 84, 64);
  if (installEvt) bouton('installer', W - 230, H - 84, 210, 64, { texte: 'Installer', taille: 26, couleur: C.vert }, () => { installEvt.prompt(); installEvt = null; });
  else if (IOS && !AUTONOME) bouton('installer', W - 230, H - 84, 210, 64, { texte: 'Installer', taille: 26, couleur: C.vert }, () => { aideIOS = true; });
  if (aideIOS) dessinerAideIOS();
}

// iPhone : Safari n'a pas de bouton d'installation, on explique le geste
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const AUTONOME = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let aideIOS = false;
function dessinerAideIOS() {
  ctx.fillStyle = 'rgba(4,6,24,0.92)'; ctx.fillRect(0, 0, W, H);
  boutons = [];
  const cx = W / 2, w = Math.min(W - 40, 560);
  G.texteFige(ctx, 'INSTALLER', cx, H * 0.22, 40, C.vert, { police: 'titre', lueur: C.vert });
  const lignes = ['Ouvre ce jeu dans Safari', 'Touche le bouton Partager', '(le carré avec une flèche vers le haut)', 'Choisis « Sur l\'écran d\'accueil »', 'Puis touche « Ajouter »'];
  lignes.forEach((l, i) => G.texte(ctx, l, cx, H * 0.34 + i * 54, l.startsWith('(') ? 22 : 30, l.startsWith('(') ? '#9aa3e0' : '#fff', {}));
  // icône Partager
  const ix = cx, iy = H * 0.34 + 5 * 54 + 30;
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 4;
  ctx.strokeRect(ix - 22, iy - 6, 44, 46);
  ctx.beginPath(); ctx.moveTo(ix, iy + 18); ctx.lineTo(ix, iy - 34); ctx.moveTo(ix - 13, iy - 21); ctx.lineTo(ix, iy - 34); ctx.lineTo(ix + 13, iy - 21); ctx.stroke();
  G.texte(ctx, 'Le jeu s\'ouvrira en plein écran, même sans internet.', cx, iy + 90, 22, C.jaune, {});
  bouton('fermer-aide', cx - 120, H - 140, 240, 72, { texte: 'OK', taille: 32, police: 'titre', couleur: C.vert }, () => { aideIOS = false; });
}

// =====================================================================
// CHOIX DE LA COUPE
// =====================================================================
function ecranCoupes(dt) {
  decoMaj(dt, false); decoDessin();
  boutonRetour(20, 20);
  G.texteFige(ctx, 'CHOISIS TA COUPE', W / 2, PORTRAIT ? 120 : 50, PORTRAIT ? 36 : 34, C.jaune, { police: 'titre', lueur: C.jaune, contour: '#1a0630' });
  // classes
  const ty = PORTRAIT ? 170 : 96, th = 78;
  const tw = Math.min(220, (W - 80) / 3);
  L.CLASSES.forEach((cl, i) => {
    const x = W / 2 + (i - 1) * (tw + 16) - tw / 2;
    const sel = sv.classe === cl.id;
    const coul = [C.vert, C.jaune, C.rouge][i];
    bouton('cl' + cl.id, x, ty, tw, th, { texte: cl.nom, taille: 30, police: 'titre', couleur: sel ? coul : '#4a52a0', fond: sel ? 'rgba(40,30,90,0.95)' : 'rgba(10,16,60,0.7)', dy: -10, sous: cl.granges + ' granges', tailleSous: 20, flou: sel ? 22 : 4 }, () => { sv.classe = cl.id; sauver(); S.sfx('clic'); });
  });
  // coupes
  const deb = L.coupesDebloquees(sv);
  const cols = PORTRAIT ? 2 : (W > 1250 ? 5 : 3);
  const zoneY = ty + th + 30, zoneH = H - zoneY - 30;
  const rows = Math.ceil(L.COUPES.length / cols);
  const gap = 18;
  const cw = Math.min(PORTRAIT ? 320 : 250, (W - 40 - gap * (cols - 1)) / cols);
  const ch = Math.min(PORTRAIT ? 300 : 300, (zoneH - gap * (rows - 1)) / rows);
  L.COUPES.forEach((cp, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const nDansRangee = Math.min(cols, L.COUPES.length - r * cols);
    const x0 = W / 2 - (nDansRangee * cw + (nDansRangee - 1) * gap) / 2;
    const x = x0 + c * (cw + gap), y = zoneY + r * (ch + gap);
    const ouverte = deb.includes(cp.id);
    const flotte = Math.sin(temps * 2 + i) * 3;
    bouton('cp' + cp.id, x, y + flotte, cw, ch, { couleur: ouverte ? cp.couleur : '#3a4180', desactive: !ouverte, dessin: (c2, w, h) => dessinCarteCoupe(c2, cp, w, h, ouverte) }, () => {
      choixCoupe = cp.id; aller('depart');
    });
  });
}
let spritesCoupe = {};
function dessinCarteCoupe(c2, cp, w, h, ouverte) {
  if (!spritesCoupe[cp.id]) spritesCoupe[cp.id] = G.coupeCouleur(cp.couleur);
  const s = Math.min(w * 0.42, h * 0.34);
  if (ouverte) {
    c2.save(); c2.shadowColor = cp.couleur; c2.shadowBlur = 20;
    G.dessiner(c2, spritesCoupe[cp.id], -s / 2, -h * 0.42, s, s * 15 / 16);
    c2.restore();
  } else {
    G.dessiner(c2, G.cadenas, -s * 0.35, -h * 0.38, s * 0.7, s * 0.7 * 7 / 8);
  }
  G.texte(c2, cp.nom.replace('Coupe ', ''), 0, h * 0.04, Math.min(32, w * 0.14), ouverte ? '#fff' : '#5b63a8', { lueur: ouverte ? cp.couleur : null });
  const tables = cp.speciale ? 'Toutes les tables !' : cp.tables.map(t => '×' + t).join('  ');
  G.texte(c2, tables, 0, h * 0.17, Math.min(24, w * 0.1), ouverte ? cp.couleur : '#5b63a8', {});
  if (!ouverte) {
    G.texte(c2, cp.speciale ? 'Gagne les 4 coupes' : 'Gagne la coupe d\'avant', 0, h * 0.32, Math.min(18, w * 0.075), '#7d86c9', {});
    return;
  }
  // trophées par classe
  const ts = Math.min(w / 5, 42);
  L.CLASSES.forEach((cl, i) => {
    const tr = L.meilleurTrophee(sv, cp.id, cl.id);
    const x = (i - 1) * (ts + 14) - ts / 2, y = h * 0.27;
    if (tr) { c2.save(); c2.shadowColor = '#ffd23f'; c2.shadowBlur = tr === 1 ? 14 : 0; G.dessiner(c2, G.trophees[tr], x, y, ts, ts * 15 / 16); c2.restore(); }
    else G.dessiner(c2, G.trophees[0], x, y, ts, ts * 15 / 16);
    G.texte(c2, cl.nom.replace('cc', ''), x + ts / 2, y + ts + 10, 14, '#9aa3e0', {});
  });
}

// =====================================================================
// GRILLE DE DÉPART (les rivaux à battre)
// =====================================================================
let choixCoupe = 'paille';
function ecranDepart(dt) {
  boutonRetour(20, 20);
  const cp = L.coupe(choixCoupe), cl = L.classe(sv.classe);
  const rec = sv.records[L.cleRecord(cp.id, cl.id)];
  const ty = PORTRAIT ? 120 : 50;
  G.texteFige(ctx, cp.nom.toUpperCase(), W / 2, ty, PORTRAIT ? 34 : 32, cp.couleur, { police: 'titre', lueur: cp.couleur, contour: '#1a0630' });
  G.texte(ctx, `${cl.nom} · ${cl.granges} granges · ${cp.speciale ? 'toutes les tables' : 'tables de ' + cp.tables.join(', ')}`, W / 2, ty + 44, 24, '#dff', {});
  const lignes = L.classement(cp.id, cl.id, rec ? rec.temps : null, sv.nom);
  const lh = Math.min(58, (H - ty - 260) / 9);
  const lw = Math.min(560, W - 40);
  const x0 = W / 2 - lw / 2, y0 = ty + 80;
  lignes.forEach((l, i) => {
    const y = y0 + i * lh;
    const app = G.sortie((tEcran - i * 0.05) * 3);
    const dx = (1 - app) * 300;
    ctx.save(); ctx.globalAlpha = app; ctx.translate(dx, 0);
    if (l.joueur) G.rectNeon(ctx, x0, y + 2, lw, lh - 4, C.rose, { fond: 'rgba(80,20,70,0.6)', flou: 12, epaisseur: 2 });
    else { ctx.fillStyle = i % 2 ? 'rgba(20,26,82,0.55)' : 'rgba(14,18,64,0.55)'; ctx.fillRect(x0, y + 2, lw, lh - 4); }
    const p = i + 1;
    G.texte(ctx, ordinal(p), x0 + 42, y + lh / 2, lh * 0.42, couleurPlace(p), { police: 'titre' });
    G.portrait(ctx, l.joueur ? 'heros' : l.id, x0 + 82, y + 4, lh - 8);
    G.texte(ctx, l.nom, x0 + 90 + lh, y + lh / 2, lh * 0.48, l.joueur ? C.rosePale : '#fff', { align: 'left' });
    G.texte(ctx, fmt(l.temps), x0 + lw - 18, y + lh / 2, lh * 0.46, l.joueur ? C.rosePale : C.cyan, { align: 'right' });
    ctx.restore();
  });
  const yb = y0 + 9 * lh + 24;
  // objectif : le rival juste au-dessus
  let msg;
  if (!rec) msg = 'Bats le plus de rivaux possible !';
  else { const p = L.place(cp.id, cl.id, rec.temps); msg = p === 1 ? 'Tu es 1er ! Améliore ton record !' : `Prochain à battre : ${lignes[p - 2].nom} (${fmt(lignes[p - 2].temps)})`; }
  G.texte(ctx, msg, W / 2, yb, 24, C.jaune, {});
  const bw = Math.min(420, W * 0.8), bh = 84;
  bouton('partez', W / 2 - bw / 2, Math.min(H - bh - 20, yb + 30), bw, bh, { texte: 'C\'EST PARTI !', taille: 30, police: 'titre', couleur: C.vert, flou: 20 + Math.sin(temps * 6) * 8 }, () => {
    lancerCourse({ mode: 'coupe', coupe: cp.id, classe: cl.id });
  });
}

// =====================================================================
// LA COURSE
// =====================================================================
let R = null;

function lancerCourse(o) {
  let qs, objectif;
  if (o.mode === 'coupe') {
    objectif = L.classe(o.classe).granges;
    qs = L.tirerQuestions(sv.maitrise, o.coupe, objectif);
  } else {
    qs = L.questionsEntrainement(o.table);
    objectif = qs.length;
  }
  const course = L.nouvelleCourse({ mode: o.mode, coupe: o.coupe, classe: o.classe, table: o.table, questions: qs, objectif });
  R = {
    course, mode: o.mode, coupe: o.coupe, classe: o.classe, table: o.table,
    phase: o.mode === 'coupe' ? 'decompte' : 'entree', t: 0,
    q: L.questionCourante(course), saisie: '', tq: 0,
    tAff: 0, prog: 0, cochons: [], totaux: [], toit: { y: 0, v: 0, pose: false, haut: true },
    coeursAff: L.COEURS, coeursCasses: [], res: null, rep: 0,
    aLancer: 0, lances: 0, poses: 0, intervalle: 0.05, prochain: 0,
    face: 'normal', decalX: 0, pause: false, pauseMenu: false,
    rangPrec: 9, depasse: [], fini: false, decompte: 3,
    rivauxTot: o.mode === 'coupe' ? L.RIVAUX.map(r => ({ id: r.id, nom: r.nom, tot: L.tempsRival(r, o.coupe, o.classe) })) : [],
    corrige: 0,
  };
  R.rangPrec = rangCourant();
  aller('course');
}

function tempsLive() { return R.course.temps + (R.phase === 'question' ? R.tq : 0); }
function progRival(rv) { return clamp(R.tAff / rv.tot, 0, 1); }
function rangCourant() {
  const pj = R.course.justes / R.course.objectif;
  let n = 1;
  for (const rv of R.rivauxTot) {
    const pr = progRival(rv);
    if (R.course.finie && !R.course.perdue) { if (rv.tot < R.course.temps) n++; }
    else if (pr > pj || pr >= 1) n++;
  }
  return n;
}

// ----- géométrie de la grange -----
function zones() {
  const z = {};
  if (PORTRAIT) {
    z.hud = { x: 0, y: 0, w: W, h: R.mode === 'coupe' ? 196 : 100 };
    z.question = { x: 0, y: z.hud.h, w: W, h: 100 };
    const kh = Math.min(H * 0.33, 430);
    z.clavier = { x: W / 2 - Math.min(W - 40, 520) / 2, y: H - kh - 16, w: Math.min(W - 40, 520), h: kh };
    z.grange = { x: 10, y: z.question.y + z.question.h, w: W - 20, h: z.clavier.y - (z.question.y + z.question.h) - 10 };
  } else {
    const pw = clamp(W * 0.32, 330, 440);
    z.hud = { x: 0, y: 0, w: W, h: R.mode === 'coupe' ? 112 : 80 };
    z.question = { x: W - pw - 10, y: z.hud.h + 4, w: pw, h: 150 };
    z.clavier = { x: W - pw - 10, y: z.question.y + z.question.h + 12, w: pw, h: H - (z.question.y + z.question.h + 12) - 16 };
    z.grange = { x: 10, y: z.hud.h, w: W - pw - 40, h: H - z.hud.h - 8 };
  }
  return z;
}
function geo(q, zg) {
  const a = q.a, b = q.b;
  const extra = 2;                    // rangées au-dessus pour le débordement
  const ML = 64, MR = 84;             // place pour les chiffres à gauche et les totaux à droite
  const cell = Math.min(86, (zg.w - ML - MR) / a, (zg.h - 30) / (b + extra + 1.9));
  const gw = a * cell, gh = b * cell;
  const gx = zg.x + ML + (zg.w - ML - MR - gw) / 2;
  const toitH = Math.min(cell * 1.35, 110);
  const besoin = (b + extra) * cell + toitH + cell * 0.95 + 30;
  let bas = zg.y + zg.h - cell * 0.95 - 8;
  if (zg.h > besoin) bas -= (zg.h - besoin) * 0.5;
  return { a, b, cell, gw, gh, gx, bas, haut: bas - gh, extra, toitH };
}
function caseXY(g, i) {
  const col = i % g.a, row = Math.floor(i / g.a);
  return { x: g.gx + col * g.cell, y: g.bas - (row + 1) * g.cell, row, col };
}

// ----- déroulé -----
function nouvelleQuestion() {
  R.q = L.questionCourante(R.course);
  R.saisie = ''; R.tq = 0; R.cochons = []; R.totaux = []; R.res = null; R.face = 'normal';
  R.toit = { y: 0, v: 0, pose: false, haut: true };
  R.corrige = 0;
  R.phase = 'entree'; R.t = 0;
  if (R.mode === 'coupe' && R.course.objectif >= 5 && R.course.justes === R.course.objectif - 1) setTimeout(() => S.voix('derniere'), 150);
}

function valider() {
  if (R.phase !== 'question' || R.pauseMenu || !R.saisie) return;
  const rep = parseInt(R.saisie, 10);
  S.sfx('valide');
  R.rep = rep;
  R.res = L.repondre(R.course, rep, R.tq, sv.maitrise);
  sauver();
  // cochons à faire tomber
  const p = R.q.a * R.q.b;
  R.aLancer = Math.min(rep, p + 60);
  R.lances = 0; R.poses = 0;
  const duree = clamp(0.7 + R.aLancer * 0.03, 0.8, 2.4);
  R.intervalle = R.aLancer ? duree / R.aLancer : 0;
  R.prochain = 0;
  R.phase = 'pluie'; R.t = 0;
}

function lancerCochon(g, i, fantome) {
  const c = caseXY(g, i);
  const zg = zones().grange;
  const horsCadre = c.row >= g.b + g.extra;
  R.cochons.push({
    i, tx: c.x, ty: c.y, x: c.x + (Math.random() - 0.5) * g.cell * 0.6, y: zg.y - g.cell * (2 + Math.random() * 2) - 40,
    vy: 300 + Math.random() * 200, vx: 0, r: (Math.random() - 0.5) * 0.8, vr: 0, etat: 'tombe', ts: 0, fantome: !!fantome,
    trop: i >= g.a * g.b, horsCadre, row: c.row,
  });
  S.sfx('chute');
}

function majCourse(dt) {
  if (!R) return;
  if (R.pauseMenu) return;
  R.t += dt;
  const z = zones();
  const g = geo(R.q, z.grange);

  // chrono : seulement pendant la réflexion
  if (R.phase === 'question') {
    R.tq += dt;
    if (R.mode === 'coupe' && Math.floor(R.tq) !== Math.floor(R.tq - dt) && R.tq > 5) S.sfx('tic');
  }
  R.tAff = lerp(R.tAff, R.mode === 'coupe' ? tempsLive() : 0, Math.min(1, dt * 8));
  R.prog = lerp(R.prog, R.course.justes / R.course.objectif, Math.min(1, dt * 5));

  // dépassements
  if (R.mode === 'coupe' && R.phase !== 'decompte') {
    const rg = rangCourant();
    if (rg < R.rangPrec) {
      // qui avons-nous doublé ?
      S.sfx('depasse');
      const pj = R.course.justes / R.course.objectif;
      const doubles = R.rivauxTot.filter(rv => progRival(rv) <= pj && progRival(rv) < 1).sort((a, b) => progRival(b) - progRival(a));
      if (doubles[0] && R.rangPrec - rg <= 2) G.pop('Tu doubles ' + doubles[0].nom + ' !', W / 2, z.hud.h + 40, { taille: 30, couleur: C.vert, police: 'texte', duree: 1.6, monte: 30 });
    }
    R.rangPrec = rg;
  }

  switch (R.phase) {
    case 'decompte': {
      const n = 3 - Math.floor(R.t / 0.75);
      if (n !== R.decompte) {
        R.decompte = n;
        if (n > 0) S.sfx('bip');
        else { S.sfx('go'); S.voix('partez'); G.grille.choc(W / 2, H / 2, 500, W); secousse = 6; }
      }
      if (R.t > 0.75 * 3 + 0.5) { R.phase = 'entree'; R.t = 0; }
      break;
    }
    case 'entree':
      if (R.t > 0.3) { R.phase = 'question'; R.t = 0; }
      break;
    case 'question': break;
    case 'pluie': {
      R.prochain -= dt;
      while (R.lances < R.aLancer && R.prochain <= 0) {
        lancerCochon(g, R.lances, false);
        R.lances++;
        R.prochain += R.intervalle;
      }
      if (R.lances >= R.aLancer && R.poses >= R.aLancer && R.t > 0.2) {
        if (R.tFinPluie == null) R.tFinPluie = R.t;
        if (R.t - R.tFinPluie > 0.3) { R.tFinPluie = null; debutVerdict(g); }
      }
      break;
    }
    case 'verdict': majVerdict(dt, g); break;
    case 'sortie':
      R.decalX = -G.sortie(R.t / 0.35) * W;
      if (R.t > 0.35) {
        R.decalX = 0;
        if (R.course.finie) { finCourse(); return; }
        nouvelleQuestion();
      }
      break;
  }

  // physique des cochons
  for (let k = R.cochons.length - 1; k >= 0; k--) {
    const c = R.cochons[k];
    c.ts += dt;
    if (c.etat === 'tombe') {
      c.vy += 2600 * dt; c.y += c.vy * dt;
      c.x = lerp(c.x, c.tx, Math.min(1, dt * 10));
      c.r = lerp(c.r, 0, Math.min(1, dt * 6));
      if (c.y >= c.ty) {
        c.y = c.ty; c.x = c.tx; c.r = 0; c.etat = 'pose'; c.ts = 0;
        R.poses++;
        const centreX = c.tx + g.cell / 2, centreY = c.ty + g.cell;
        G.eclat(centreX, centreY, c.fantome ? 5 : 8, c.fantome ? [C.cyan, '#fff'] : [C.rosePale, '#fff', C.rose], 260, { taille: Math.max(4, g.cell * 0.09), duree: 0.45, grav: 900, angle: -Math.PI / 2, cone: 2.6 });
        G.grille.choc(centreX, centreY, 70, 110);
        S.sfx('plop', R.poses + R.corrige);
        if (c.horsCadre) { ejecter(c, true); }
        else if (!c.trop) {
          // rangée complète ? (on compte de 1 en 1 de la table)
          const total = R.poses + R.corrige;
          if (total % g.a === 0 && total <= g.a * g.b) {
            const rr = total / g.a - 1;
            if (!R.totaux.find(t => t.r === rr)) { R.totaux.push({ r: rr, val: total, t: 0 }); S.sfx('rangee', rr); }
          }
        }
      }
    } else if (c.etat === 'ejecte') {
      c.vy += 2200 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt;
      if (c.y > H + 100 || c.x < -200 || c.x > W + 200) R.cochons.splice(k, 1);
    }
  }
  for (const t of R.totaux) t.t += dt;

  // toit
  const T = R.toit;
  if (T.pose) {
    T.v += 5000 * dt; T.y += T.v * dt;
    if (T.y >= 0) { if (T.v > 400) { T.v = -T.v * 0.25; } else { T.v = 0; } T.y = Math.min(T.y, 0); }
  }
}

function ejecter(c, immediat) {
  c.etat = 'ejecte';
  c.vx = (c.tx + 1 < W / 2 ? -1 : 1) * (300 + Math.random() * 500) * (Math.random() < 0.3 ? -1 : 1);
  c.vy = -700 - Math.random() * 600;
  c.vr = (Math.random() - 0.5) * 18;
  if (!immediat) S.sfx('ejecte');
}

function debutVerdict(g) {
  R.phase = 'verdict'; R.t = 0; R.etape = 0;
  const v = R.res.v;
  const zq = zones().grange;
  const cx = g.gx + g.gw / 2;
  if (v === 'juste') {
    R.face = 'content';
    poserToit(g, true);
    S.voix(['parfait', 'bravo', 'super'][Math.floor(Math.random() * 3)]);
    G.pop(['PARFAIT !', 'BRAVO !', 'SUPER !', 'GÉNIAL !'][Math.floor(Math.random() * 4)], cx, Math.max(zq.y + 60, g.haut - g.toitH - 40), { taille: Math.min(64, W / 11), couleur: C.jaune, duree: 1.4 });
  } else {
    S.sfx('faux');
    const p = g.a * g.b;
    if (v === 'manque') {
      R.face = 'normal';
      S.voix('manque');
      const n = p - R.rep;
      banniere(`IL MANQUE ${n} COCHON${n > 1 ? 'S' : ''} !`, zq);
    } else {
      R.face = 'surpris';
      S.voix('deborde');
      const n = R.rep - p;
      banniere(`ÇA DÉBORDE ! ${n} DE TROP`, zq);
    }
    if (R.mode === 'coupe') casserCoeur();
    flash = 0.35; flashCouleur = '#ff2040';
    secousse = 10;
  }
}

function banniere(txt, zg) {
  const lar = G.largeur(ctx, txt, 40, 'titre');
  const taille = Math.min(40, 40 * (zg.w - 40) / lar);
  G.pop(txt, zg.x + zg.w / 2, zg.y + zg.h * 0.42, { taille, couleur: C.rouge, duree: 1.7, monte: 0, bande: { x: zg.x, w: zg.w } });
}

function poserToit(g, fete) {
  R.toit.pose = true; R.toit.haut = false;
  R.toit.y = -(g.extra * g.cell + 120); R.toit.v = 600;
  setTimeout(() => {
    if (!R) return;
    S.sfx('toit');
    secousse = fete ? 16 : 8;
    const cx = g.gx + g.gw / 2;
    G.grille.choc(cx, g.haut, fete ? 900 : 400, Math.max(W, H) * 0.8);
    if (fete) {
      S.sfx('parfait');
      G.eclat(cx, g.haut, 90, [C.rose, C.cyan, C.jaune, C.vert, '#fff'], 900, { taille: 10, duree: 1.3, grav: 700, tourne: true, frot: 1.8 });
      flash = 0.25; flashCouleur = '#ffffff';
    }
  }, 120);
}

function casserCoeur() {
  R.coeursAff = R.course.coeurs;
  const z = zones();
  const pos = posCoeur(z, R.coeursAff);
  G.eclat(pos.x + pos.s / 2, pos.y + pos.s / 2, 40, [C.rouge, '#ff8899', '#fff'], 500, { taille: 8, duree: 0.9, grav: 1200 });
  setTimeout(() => S.sfx('coeur'), 80);
  if (R.mode === 'coupe') G.pop('+' + L.PENALITE + ' s', W - 150, PORTRAIT ? 150 : 100, { taille: 34, couleur: C.rouge, police: 'titre', duree: 1.2, monte: -40 });
}

function majVerdict(dt, g) {
  const v = R.res.v, p = g.a * g.b;
  if (v === 'juste') {
    if (R.t > 1.6) { R.phase = 'sortie'; R.t = 0; S.sfx('whoosh'); }
    return;
  }
  if (v === 'manque') {
    // après une pause, les cochons manquants arrivent en fantômes
    if (R.etape === 0 && R.t > 1.0) {
      R.etape = 1; R.fantomes = p - R.rep; R.fLances = 0; R.fProchain = 0;
      R.fIntervalle = clamp(1.2 / Math.max(1, R.fantomes), 0.03, 0.18);
    }
    if (R.etape === 1) {
      R.fProchain -= dt;
      while (R.fLances < R.fantomes && R.fProchain <= 0) {
        lancerCochon(g, R.rep + R.fLances, true);
        R.fLances++; R.fProchain += R.fIntervalle;
      }
      if (R.fLances >= R.fantomes && R.poses >= p && !R.tEt2) { R.tEt2 = R.t; poserToit(g, false); }
      if (R.tEt2 && R.t - R.tEt2 > 1.9) { R.tEt2 = null; R.phase = 'sortie'; R.t = 0; S.sfx('whoosh'); }
    }
  } else {
    if (R.etape === 0 && R.t > 0.9) {
      R.etape = 1;
      for (const c of R.cochons) if (c.trop && c.etat === 'pose') ejecter(c);
      R.poses = p; R.face = 'normal';
      setTimeout(() => R && R.phase === 'verdict' && poserToit(g, false), 450);
      R.tEt2 = R.t;
    }
    if (R.etape === 1 && R.t - R.tEt2 > 2.4) { R.tEt2 = null; R.phase = 'sortie'; R.t = 0; S.sfx('whoosh'); }
  }
}

function finCourse() {
  const c = R.course;
  R.phase = 'fin';
  if (R.mode === 'coupe') {
    if (c.perdue) {
      FIN = { mode: 'coupe', perdue: true, coupe: R.coupe, classe: R.classe, temps: c.temps, justes: c.justes, objectif: c.objectif };
      setTimeout(() => S.voix('perdu'), 400);
    } else {
      const r = L.enregistrer(sv, R.coupe, R.classe, c.temps);
      sauver();
      FIN = { mode: 'coupe', perdue: false, coupe: R.coupe, classe: R.classe, temps: c.temps, place: r.place, record: r.record, ancien: r.ancien, nouvelles: r.nouvelles, penalites: c.penalites, premierCoup: c.premierCoup, objectif: c.objectif, erreurs: c.erreurs };
      const tr = L.trophee(r.place);
      setTimeout(() => { S.sfx(tr ? 'trophee' : 'oh'); }, 500);
      setTimeout(() => S.voix(tr === 1 ? 'or' : tr === 2 ? 'argent' : tr === 3 ? 'bronze' : 'pasdepodium'), 1300);
      let d = 4200;
      if (r.record && r.ancien != null) { setTimeout(() => S.voix('record'), d); d += 1800; }
      if (r.nouvelles.length) setTimeout(() => S.voix('debloque'), d);
    }
  } else {
    FIN = { mode: 'entrainement', table: R.table, premierCoup: c.premierCoup, total: c.objectif, erreurs: c.erreurs };
    const n = c.premierCoup;
    setTimeout(() => { S.sfx(n >= 8 ? 'trophee' : 'parfait'); S.voix(n >= 9 ? 'parfait' : n >= 7 ? 'bravo' : 'super'); }, 400);
  }
  ecran = 'resultats'; tEcran = 0;
  S.jouerMusique('menu');
}

// ----- clavier -----
function touche(ch) {
  if (!R || R.pauseMenu) return;
  if (R.phase !== 'question') return;
  if (ch === 'del') { if (R.saisie) { R.saisie = R.saisie.slice(0, -1); S.sfx('efface'); } return; }
  if (ch === 'ok') { valider(); return; }
  if (R.saisie.length >= 3) return;
  if (R.saisie === '0') R.saisie = '';
  R.saisie += ch;
  S.sfx('touche', +ch);
}

// ----- rendu de la course -----
function posCoeur(z, i) {
  const s = PORTRAIT ? 44 : 38;
  const y = PORTRAIT ? z.hud.y + 140 : z.hud.y + 70;
  return { x: 18 + i * (s + 8), y, s };
}

function ecranCourse(dt) {
  majCourse(dt);
  if (!R || ecran !== 'course') return;
  const z = zones();
  const g = geo(R.q, z.grange);

  // HUD
  dessinerHud(z);

  // grange
  ctx.save();
  let dx = R.decalX;
  if (R.phase === 'entree') dx = (1 - G.sortie(R.t / 0.3)) * W * 0.6;
  ctx.translate(dx, 0);
  if (R.phase !== 'decompte') dessinerGrange(g, z);
  ctx.restore();

  // question + clavier
  dessinerQuestion(z, g);
  dessinerClavier(z);

  if (R.phase === 'decompte') {
    const n = R.decompte;
    const k = (R.t % 0.75) / 0.75;
    const txt = n > 0 ? String(n) : 'PARTEZ !';
    const s = (n > 0 ? 160 : Math.min(110, W / 7)) * (1.4 - 0.4 * G.sortie(k * 2));
    ctx.save(); ctx.globalAlpha = n > 0 ? 1 - k * 0.6 : 1;
    G.texte(ctx, txt, z.grange.x + z.grange.w / 2, z.grange.y + z.grange.h / 2, s, n > 0 ? C.jaune : C.vert, { police: 'titre', contour: '#1a0630', lueur: n > 0 ? C.jaune : C.vert });
    ctx.restore();
  }

  if (R.pauseMenu) dessinerPause();
}

function dessinerHud(z) {
  const h = z.hud;
  if (R.mode === 'coupe') {
    // rang
    const rg = rangCourant();
    const rs = PORTRAIT ? 58 : 52;
    const pulse = 1 + Math.max(0, 0.25 - (temps - (R.tRang || 0))) * 1.5;
    if (rg !== R.rangAff) { R.rangAff = rg; R.tRang = temps; }
    ctx.save(); ctx.translate(16, PORTRAIT ? 48 : 38); ctx.scale(pulse, pulse);
    G.texte(ctx, ordinal(rg), 0, 0, rg === 1 ? rs * 0.8 : rs, couleurPlace(rg), { police: 'titre', contour: '#1a0630', lueur: couleurPlace(rg), align: 'left' });
    ctx.restore();
    // chrono
    const tl = R.tAff;
    G.texte(ctx, fmt(tempsLive()).replace(' s', ''), W - 112, PORTRAIT ? 48 : 38, PORTRAIT ? 44 : 36, C.cyan, { police: 'titre', align: 'right', lueur: C.cyan });
    G.texte(ctx, 's', W - 104, PORTRAIT ? 56 : 46, 26, C.cyan, { align: 'left', police: 'titre' });
    // piste
    const px0 = PORTRAIT ? 40 : 190, px1 = PORTRAIT ? W - 60 : W - 330;
    const py = PORTRAIT ? 104 : 40;
    dessinerPiste(px0, px1, py, PORTRAIT ? 40 : 32);
    // coeurs
    for (let i = 0; i < L.COEURS; i++) {
      const p = posCoeur(z, i);
      const plein = i < R.coeursAff;
      const bat = plein && i === R.coeursAff - 1 ? 1 + Math.sin(temps * 6) * 0.06 : 1;
      ctx.save(); ctx.translate(p.x + p.s / 2, p.y + p.s / 2); ctx.scale(bat, bat);
      if (plein) { ctx.shadowColor = C.rouge; ctx.shadowBlur = 16; }
      G.dessiner(ctx, plein ? G.coeur : G.coeurVide, -p.s / 2, -p.s / 2, p.s, p.s * 10 / 11);
      ctx.restore();
    }
    // granges faites
    const cp = L.coupe(R.coupe);
    G.texte(ctx, `Grange ${Math.min(R.course.justes + 1, R.course.objectif)} / ${R.course.objectif}`, PORTRAIT ? W - 24 : z.grange.x + z.grange.w - 10, posCoeur(z, 0).y + 20, 28, '#cfe', { align: 'right' });
  } else {
    G.texteFige(ctx, 'ENTRAÎNEMENT', W / 2, 30, 26, C.vert, { police: 'titre', lueur: C.vert });
    G.texte(ctx, `Table de ${R.table} · ${R.course.justes} / ${R.course.objectif}`, W / 2, 64, 26, '#cfe', {});
  }
  // pause
  bouton('pause', W - 70, 12, 56, 56, { couleur: C.violet, dessin: (c2) => { c2.fillStyle = '#fff'; c2.fillRect(-11, -13, 8, 26); c2.fillRect(3, -13, 8, 26); } }, () => { R.pauseMenu = true; S.sfx('clic'); });
}

function dessinerPiste(x0, x1, y, ps) {
  // ligne néon
  ctx.save();
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.shadowColor = C.cyan; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.restore();
  for (let k = 0; k <= 10; k++) { ctx.fillStyle = 'rgba(77,243,255,0.5)'; ctx.fillRect(x0 + (x1 - x0) * k / 10 - 1, y - 5, 2, 10); }
  G.dessiner(ctx, G.drapeau, x1 + 4, y - 30, 28, 28);
  // rivaux (deux couloirs)
  const liste = R.rivauxTot.map((rv, i) => ({ rv, i, p: progRival(rv) }));
  liste.sort((a, b) => a.p - b.p);
  for (const o of liste) {
    const x = x0 + (x1 - x0) * o.p;
    const yy = y + (o.i % 2 ? ps * 0.42 : -ps * 0.42) - ps / 2;
    G.portrait(ctx, o.rv.id, x - ps / 2, yy, ps, o.p >= 1 ? 0.55 : 0.9);
  }
  // le joueur, plus gros
  const xj = x0 + (x1 - x0) * R.prog;
  const pj = ps * 1.45;
  ctx.save(); ctx.shadowColor = C.rose; ctx.shadowBlur = 18;
  G.portrait(ctx, 'heros', xj - pj / 2, y - pj / 2 + Math.sin(temps * 8) * 2, pj);
  ctx.restore();
}

function dessinerGrange(g, z) {
  const { a, b, cell, gx, bas, haut, gw } = g;
  const C1 = C.cyan, C2 = C.rose;
  // cases
  ctx.save();
  ctx.strokeStyle = 'rgba(77,243,255,0.25)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i < a; i++) { ctx.moveTo(gx + i * cell, haut); ctx.lineTo(gx + i * cell, bas); }
  for (let j = 1; j < b; j++) { ctx.moveTo(gx, bas - j * cell); ctx.lineTo(gx + gw, bas - j * cell); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,30,110,0.35)'; ctx.fillRect(gx, haut, gw, g.gh);
  // cases vides qui clignotent en rouge quand il manque des cochons
  if (R.phase === 'verdict' && R.res && R.res.v === 'manque' && R.etape === 0) {
    const on = Math.floor(R.t * 6) % 2 === 0;
    for (let i = R.rep; i < a * b; i++) {
      const c = caseXY(g, i);
      ctx.fillStyle = on ? 'rgba(255,40,80,0.45)' : 'rgba(255,40,80,0.15)';
      ctx.fillRect(c.x + 3, c.y + 3, cell - 6, cell - 6);
    }
  }
  ctx.restore();
  // murs (planches néon)
  const ep = Math.max(6, cell * 0.12);
  ctx.save();
  ctx.shadowColor = C1; ctx.shadowBlur = 18; ctx.fillStyle = '#9ff6ff';
  ctx.fillRect(gx - ep, haut - 4, ep, g.gh + ep + 4);
  ctx.fillRect(gx + gw, haut - 4, ep, g.gh + ep + 4);
  ctx.fillRect(gx - ep, bas, gw + ep * 2, ep);
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,60,90,0.6)';
  for (let j = 0; j < b; j++) { ctx.fillRect(gx - ep, bas - j * cell - 2, ep, 2); ctx.fillRect(gx + gw, bas - j * cell - 2, ep, 2); }
  for (let i = 0; i < a; i++) ctx.fillRect(gx + i * cell, bas, 2, ep);
  ctx.restore();

  // crochets de dimensions (a en cyan en bas, b en rose à gauche)
  const yb = bas + ep + 14;
  ctx.save();
  ctx.lineWidth = 4; ctx.strokeStyle = C1; ctx.shadowColor = C1; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(gx, yb - 8); ctx.lineTo(gx, yb); ctx.lineTo(gx + gw, yb); ctx.lineTo(gx + gw, yb - 8); ctx.stroke();
  ctx.strokeStyle = C2; ctx.shadowColor = C2;
  const xb = gx - ep - 16;
  ctx.beginPath(); ctx.moveTo(xb + 8, haut); ctx.lineTo(xb, haut); ctx.lineTo(xb, bas); ctx.lineTo(xb + 8, bas); ctx.stroke();
  ctx.restore();
  const tn = clamp(cell * 0.6, 26, 44);
  G.texte(ctx, String(a), gx + gw / 2, yb + tn * 0.75, tn, C1, { police: 'titre', lueur: C1, contour: '#06102a' });
  G.texte(ctx, String(b), xb - tn * 0.7, (haut + bas) / 2, tn, C2, { police: 'titre', lueur: C2, contour: '#06102a' });

  // toit
  dessinerToit(g);

  // cochons
  const s = cell * 0.9, o = (cell - s) / 2;
  const cligne = Math.floor(temps * 1.3) % 5 === 0 && (temps * 1.3) % 1 < 0.12;
  for (const c of R.cochons) {
    let face = R.face;
    if (face === 'normal' && cligne && (c.i % 3 === 0)) face = 'cligne';
    if (c.trop && R.res && R.res.v === 'deborde') face = 'surpris';
    const spr = c.fantome ? G.cochons['f_' + (face === 'content' ? 'content' : 'normal')] : G.cochons[face];
    let sx = 1, sy = 1, oy = 0;
    if (c.etat === 'pose' && c.ts < 0.3) {
      const e = Math.sin(c.ts / 0.3 * Math.PI * 2) * (1 - c.ts / 0.3);
      sx = 1 + 0.22 * e; sy = 1 - 0.25 * e;
    }
    if (c.etat === 'pose' && R.face === 'content') {
      // vague de joie
      oy = -Math.max(0, Math.sin(temps * 10 - c.i * 0.35)) * cell * 0.12;
    }
    if (c.etat === 'tombe') { sx = 0.85; sy = 1.15; }
    ctx.save();
    ctx.translate(c.x + cell / 2, c.y + cell + oy);
    ctx.rotate(c.r);
    ctx.scale(sx, sy);
    if (c.trop && c.etat === 'pose') ctx.translate(Math.sin(temps * 40 + c.i) * 2, 0);
    if (c.fantome) G.dessiner(ctx, spr, -s / 2, -s * 13 / 14 - o, s, s * 13 / 14);
    else G.cochon(ctx, face, -s / 2, -s * 13 / 14 - o, s, s * 13 / 14);
    ctx.restore();
  }

  // compteur de cochons
  const nb = R.poses;
  if (R.phase === 'pluie' || R.phase === 'verdict' || R.phase === 'sortie') {
    const juste = R.res && R.res.v === 'juste';
    const fini = R.phase !== 'pluie';
    const coul = fini ? (juste || (R.etape === 1 && R.poses === a * b) ? C.vert : C.rouge) : C.cyan;
    const tc = clamp(cell * 0.8, 34, 64);
    const lw = G.largeur(ctx, String(nb), tc, 'titre') + 48;
    let tx = gx + gw + ep + 20, ty = Math.max(z.grange.y + 40, haut - g.toitH * 0.5);
    if (tx + lw > z.grange.x + z.grange.w + 10) {
      // pas de place à droite : au-dessus de la grange
      tx = gx + gw / 2 - lw / 2;
      ty = Math.max(z.grange.y + 30, haut - g.extra * cell - g.toitH - 50);
    }
    G.texte(ctx, String(nb), tx, ty, tc, coul, { police: 'titre', align: 'left', lueur: coul, contour: '#06102a' });
    G.dessiner(ctx, G.cochons.normal, tx + lw - 38, ty - 18, 38, 35);
  }
  // totaux par rangée (on compte de a en a)
  for (const t of R.totaux) {
    const y = bas - (t.r + 0.5) * cell;
    const k = G.elastique(Math.min(1, t.t * 3));
    ctx.save(); ctx.translate(gx + gw + ep + 14, y); ctx.scale(k, k);
    G.texte(ctx, String(t.val), 0, 0, clamp(cell * 0.42, 16, 30), C.jaune, { align: 'left', lueur: C.jaune, flou: 6 });
    ctx.restore();
  }
}

function dessinerToit(g) {
  const { gx, gw, haut, cell, toitH } = g;
  const T = R.toit;
  let yb;
  if (T.haut) yb = haut - g.extra * cell - 16 + Math.sin(temps * 2) * 6;
  else yb = haut + T.y;
  const x0 = gx - cell * 0.3, x1 = gx + gw + cell * 0.3, w = x1 - x0, h = toitH;
  const alpha = T.haut ? 0.55 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x0, yb); ctx.lineTo(x0 + w * 0.1, yb - h * 0.55); ctx.lineTo(x0 + w * 0.5, yb - h); ctx.lineTo(x1 - w * 0.1, yb - h * 0.55); ctx.lineTo(x1, yb); ctx.closePath();
  ctx.fillStyle = 'rgba(40,140,220,0.35)'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(160,240,255,0.35)'; ctx.lineWidth = 2;
  for (let y = yb - h; y < yb; y += Math.max(8, h / 7)) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 4; ctx.shadowColor = C.cyan; ctx.shadowBlur = 16; ctx.stroke();
  // lucarne
  const fw = Math.min(h * 0.45, w * 0.18), fx = x0 + w / 2 - fw / 2, fy = yb - h * 0.62;
  ctx.lineWidth = 3; ctx.strokeRect(fx, fy, fw, fw);
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + fw, fy + fw); ctx.moveTo(fx + fw, fy); ctx.lineTo(fx, fy + fw); ctx.stroke();
  ctx.restore();
}

function dessinerQuestion(z, g) {
  const q = R.q; if (!q) return;
  const zq = z.question;
  const cx = zq.x + zq.w / 2;
  const cy = PORTRAIT ? zq.y + zq.h / 2 : zq.y + 50;
  if (R.phase === 'decompte') { G.texte(ctx, 'Prêt ?', cx, cy, 44, '#fff', { police: 'titre', lueur: C.cyan }); return; }
  const montrer = R.phase !== 'entree' || R.t > 0.1;
  if (!montrer) return;
  // « 4 × 6 = __ »
  const rep = R.saisie;
  const curseur = R.phase === 'question' && Math.floor(temps * 2.5) % 2 === 0 ? '_' : ' ';
  const champ = R.phase === 'question' ? (rep || '') + (rep.length < 3 ? curseur : '') : String(R.rep);
  const parts = [[String(q.a), C.cyan], ['×', '#fff'], [String(q.b), C.rose], ['=', '#fff']];
  let ts = 60;
  const mesure = t => { ctx.font = G.police('titre', t); const esp = t * 0.35; return parts.reduce((s2, p) => s2 + ctx.measureText(p[0]).width + esp, 0) + ctx.measureText('000').width + t * 0.5; };
  ts = Math.min(60, 60 * (zq.w - 24) / mesure(60));
  const tot = mesure(ts);
  const esp = ts * 0.35;
  ctx.font = G.police('titre', ts);
  const boiteW = ctx.measureText('000').width + ts * 0.5;
  let x = cx - tot / 2;
  for (const [s2, c] of parts) { const w = ctx.measureText(s2).width; G.texte(ctx, s2, x, cy, ts, c, { police: 'titre', align: 'left', lueur: c, flou: 10 }); x += w + esp; }
  let coulB = C.jaune;
  if (R.res && R.phase !== 'question' && R.phase !== 'entree') coulB = R.res.v === 'juste' ? C.vert : C.rouge;
  G.rectNeon(ctx, x, cy - ts * 0.75, boiteW, ts * 1.5, coulB, { fond: 'rgba(10,10,40,0.8)', flou: 14, epaisseur: 3 });
  G.texte(ctx, champ, x + boiteW / 2, cy, ts, coulB, { police: 'titre', lueur: coulB, flou: 10 });
  // correction
  if (R.res && !R.res.juste && R.phase === 'verdict' && R.etape >= 1) {
    const ok = `${q.a} × ${q.b} = ${q.a * q.b}`;
    const yy = PORTRAIT ? zq.y + zq.h + 18 : zq.y + 118;
    const tc = Math.min(34, 34 * (zq.w - 20) / G.largeur(ctx, ok, 34, 'titre'));
    G.texte(ctx, ok, cx, yy, tc, C.vert, { police: 'titre', lueur: C.vert, contour: '#06102a' });
  }
}

function dessinerClavier(z) {
  const k = z.clavier;
  const touches = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['del', '0', 'ok']];
  const gap = 12;
  const bw = (k.w - gap * 2) / 3, bh = (k.h - gap * 3) / 4;
  const actif = R.phase === 'question' && !R.pauseMenu;
  touches.forEach((ligne, j) => ligne.forEach((t, i) => {
    const x = k.x + i * (bw + gap), y = k.y + j * (bh + gap);
    let o = { texte: t, taille: Math.min(bh * 0.5, 48), police: 'titre', couleur: C.cyan, desactive: !actif };
    if (t === 'del') o = Object.assign(o, { texte: '<', couleur: '#ff9d3c' });
    if (t === 'ok') o = Object.assign(o, { texte: 'OK', couleur: C.vert, desactive: !actif || !R.saisie, flou: R.saisie ? 22 : 8 });
    bouton('k' + t, x, y, bw, bh, o, () => touche(t));
  }));
}

function dessinerPause() {
  ctx.fillStyle = 'rgba(4,6,24,0.88)'; ctx.fillRect(0, 0, W, H);
  boutons = [];
  G.texte(ctx, 'PAUSE', W / 2, H * 0.3, 64, C.cyan, { police: 'titre', lueur: C.cyan });
  const bw = Math.min(420, W * 0.8), bh = 84;
  bouton('reprendre', W / 2 - bw / 2, H * 0.45, bw, bh, { texte: 'REPRENDRE', taille: 30, police: 'titre', couleur: C.vert }, () => { R.pauseMenu = false; S.sfx('clic'); });
  bouton('abandon', W / 2 - bw / 2, H * 0.45 + bh + 24, bw, bh * 0.8, { texte: 'Quitter la course', taille: 30, couleur: C.rouge }, () => { const m = R.mode; R.pauseMenu = false; R = null; ecran = m === 'entrainement' ? 'tables' : 'depart'; tEcran = 0; S.jouerMusique('menu'); });
}

// =====================================================================
// RÉSULTATS
// =====================================================================
let FIN = null;
function ecranResultats(dt) {
  if (!FIN) { ecran = 'titre'; return; }
  if (FIN.mode === 'entrainement') return resultatsEntrainement(dt);
  const cp = L.coupe(FIN.coupe), cl = L.classe(FIN.classe);
  const t = tEcran;
  if (FIN.perdue) {
    G.texte(ctx, 'PLUS DE CŒURS !', W / 2, H * 0.22, Math.min(54, W / 13), C.rouge, { police: 'titre', lueur: C.rouge, contour: '#1a0630' });
    G.dessiner(ctx, G.coeurVide, W / 2 - 60, H * 0.32, 120, 110);
    G.texte(ctx, `${FIN.justes} grange${FIN.justes > 1 ? 's' : ''} sur ${FIN.objectif}. Les cochons t'attendent !`, W / 2, H * 0.55, 28, '#dff', {});
    G.texte(ctx, 'Astuce : regarde les rangées, on compte de ' + 'table en table.', W / 2, H * 0.6, 22, '#9aa3e0', {});
    boutonsFin(H * 0.68);
    return;
  }
  const tr = L.trophee(FIN.place);
  // confettis pour l'or
  if (tr === 1 && Math.random() < dt * 20) G.eclat(Math.random() * W, -10, 3, [C.jaune, C.rose, C.cyan, '#fff'], 120, { grav: 200, duree: 3, taille: 9, tourne: true, frot: 0.5 });
  G.texteFige(ctx, 'ARRIVÉE !', W / 2, PORTRAIT ? 70 : 46, PORTRAIT ? 50 : 44, C.jaune, { police: 'titre', lueur: C.jaune, contour: '#1a0630' });
  G.texte(ctx, `${cp.nom} · ${cl.nom}`, W / 2, PORTRAIT ? 116 : 88, 24, cp.couleur, {});

  // trophée / place
  const colG = PORTRAIT ? { x: 0, y: 140, w: W, h: 300 } : { x: 0, y: 110, w: W * 0.42, h: H - 230 };
  const k = G.elastique(clamp((t - 0.4) * 1.6, 0, 1));
  const cxT = colG.x + colG.w / 2;
  const ts = Math.min(colG.h * 0.55, PORTRAIT ? 170 : 210);
  ctx.save(); ctx.translate(cxT, colG.y + ts * 0.6 + 10); ctx.scale(k, k); ctx.rotate(Math.sin(temps * 2) * 0.05);
  if (tr) {
    // rayons
    ctx.save(); ctx.rotate(temps * 0.5); ctx.globalAlpha = 0.25; ctx.fillStyle = couleurPlace(tr);
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ts * 1.1, -ts * 0.12); ctx.lineTo(ts * 1.1, ts * 0.12); ctx.fill(); }
    ctx.restore();
    ctx.shadowColor = couleurPlace(tr); ctx.shadowBlur = 40;
    G.dessiner(ctx, G.trophees[tr], -ts / 2, -ts * 0.55, ts, ts * 15 / 16);
  } else {
    G.portrait(ctx, 'heros', -ts * 0.4, -ts * 0.5, ts * 0.8);
  }
  ctx.restore();
  const yp = colG.y + ts * 1.2 + 30;
  G.texte(ctx, ordinal(FIN.place) + (tr ? '' : ' place'), cxT, yp, PORTRAIT ? 54 : 50, couleurPlace(FIN.place), { police: 'titre', lueur: couleurPlace(FIN.place), contour: '#1a0630' });
  G.texte(ctx, fmt(FIN.temps), cxT, yp + 52, 36, C.cyan, { police: 'titre', lueur: C.cyan });
  let info = `${FIN.premierCoup}/${FIN.objectif} du premier coup`;
  if (FIN.penalites) info += ` · pénalités +${FIN.penalites} s`;
  G.texte(ctx, info, cxT, yp + 92, 22, '#cfe', {});
  if (FIN.record && t > 2.2) {
    const kk = G.elastique(clamp((t - 2.2) * 2, 0, 1));
    ctx.save(); if (PORTRAIT) ctx.translate(W * 0.64, colG.y + 30); else ctx.translate(cxT, yp + 136); ctx.rotate(PORTRAIT ? -0.15 : -0.06); ctx.scale(kk, kk);
    G.texte(ctx, FIN.ancien == null ? 'PREMIER TEMPS !' : 'NOUVEAU RECORD !', 0, 0, PORTRAIT ? 24 : 28, C.rose, { police: 'titre', lueur: C.rose, contour: '#1a0630' });
    ctx.restore();
  }

  // classement
  const lignes = L.classement(FIN.coupe, FIN.classe, FIN.temps, sv.nom);
  const zx = PORTRAIT ? 20 : W * 0.44, zy = PORTRAIT ? yp + 120 : 110, zw = PORTRAIT ? W - 40 : W * 0.54, zh = PORTRAIT ? H - (yp + 120) - 130 : H - 230;
  const lh = Math.min(PORTRAIT ? 66 : 54, zh / 9);
  lignes.forEach((l, i) => {
    const y = zy + i * lh;
    const app = G.sortie((t - 0.8 - i * 0.08) * 3);
    if (app <= 0) return;
    ctx.save(); ctx.globalAlpha = app; ctx.translate((1 - app) * 200, 0);
    if (l.joueur) G.rectNeon(ctx, zx, y + 2, zw, lh - 4, C.rose, { fond: 'rgba(90,20,80,0.7)', flou: 14 + Math.sin(temps * 6) * 6, epaisseur: 2 });
    else { ctx.fillStyle = i % 2 ? 'rgba(20,26,82,0.6)' : 'rgba(14,18,64,0.6)'; ctx.fillRect(zx, y + 2, zw, lh - 4); }
    G.texte(ctx, ordinal(i + 1), zx + 36, y + lh / 2, lh * 0.4, couleurPlace(i + 1), { police: 'titre' });
    G.portrait(ctx, l.joueur ? 'heros' : l.id, zx + 72, y + 4, lh - 8);
    G.texte(ctx, l.nom, zx + 80 + lh, y + lh / 2, lh * 0.46, l.joueur ? C.rosePale : '#fff', { align: 'left' });
    G.texte(ctx, fmt(l.temps), zx + zw - 16, y + lh / 2, lh * 0.44, l.joueur ? C.rosePale : C.cyan, { align: 'right' });
    ctx.restore();
  });
  if (FIN.nouvelles && FIN.nouvelles.length && t > 3) {
    const nc = L.coupe(FIN.nouvelles[0]);
    G.texte(ctx, `Nouvelle coupe : ${nc.nom} !`, W / 2, H - 120, 28, nc.couleur, { lueur: nc.couleur });
  }
  boutonsFin(H - 96);
}

function boutonsFin(y) {
  const bw = Math.min(300, (W - 60) / 2), bh = 72;
  bouton('rejouer', W / 2 - bw - 10, y, bw, bh, { texte: 'REJOUER', taille: 28, police: 'titre', couleur: C.vert }, () => {
    if (FIN.mode === 'coupe') { lancerCourse({ mode: 'coupe', coupe: FIN.coupe, classe: FIN.classe }); }
    else lancerCourse({ mode: 'entrainement', table: FIN.table });
  });
  bouton('suite', W / 2 + 10, y, bw, bh, { texte: FIN.mode === 'coupe' ? 'COUPES' : 'TABLES', taille: 28, police: 'titre', couleur: C.cyan }, () => {
    ecran = FIN.mode === 'coupe' ? 'coupes' : 'tables'; tEcran = 0; S.sfx('whoosh');
  });
}

function resultatsEntrainement(dt) {
  const n = FIN.premierCoup, tot = FIN.total;
  G.texte(ctx, `TABLE DE ${FIN.table}`, W / 2, H * 0.16, Math.min(50, W / 12), C.vert, { police: 'titre', lueur: C.vert, contour: '#1a0630' });
  const etoiles = n >= 10 ? 3 : n >= 8 ? 2 : n >= 5 ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    const k = G.elastique(clamp((tEcran - 0.5 - i * 0.3) * 2, 0, 1));
    const s = 100;
    ctx.save(); ctx.translate(W / 2 + (i - 1) * (s + 20), H * 0.33); ctx.scale(k, k);
    if (i < etoiles) { ctx.shadowColor = C.jaune; ctx.shadowBlur = 24; G.dessiner(ctx, G.etoile, -s / 2, -s / 2, s, s); }
    else G.dessiner(ctx, G.etoile, -s / 2, -s / 2, s, s, 0.18);
    ctx.restore();
  }
  G.texte(ctx, `${n} sur ${tot} du premier coup !`, W / 2, H * 0.48, 34, '#fff', { lueur: C.cyan });
  const connue = L.tableConnue(sv.maitrise, FIN.table);
  G.texte(ctx, connue ? 'Tu connais cette table !' : 'Encore un peu et elle sera dans ta tête !', W / 2, H * 0.55, 26, connue ? C.vert : C.jaune, {});
  boutonsFin(H * 0.66);
}

// =====================================================================
// ASTUCES : flash cards avec explications
// =====================================================================
const NOM_ASTUCE = { 1: 'rien ne change', 2: 'le double', 3: 'double + 1 fois', 4: 'double du double', 5: 'moitié de ×10', 6: '×5 + 1 fois', 7: '×5 + ×2', 8: '3 doubles', 9: '×10 − 1 fois', 10: '+ un zéro' };
let F = null;   // paquet de cartes en cours

function ecranAstuces(dt) {
  boutonRetour(20, 20);
  G.texteFige(ctx, 'ASTUCES', W / 2, PORTRAIT ? 120 : 46, PORTRAIT ? 44 : 38, C.violet, { police: 'titre', lueur: C.violet, contour: '#1a0630' });
  G.texte(ctx, 'Des cartes pour calculer plus vite', W / 2, PORTRAIT ? 172 : 90, 26, '#dff', {});
  const cols = PORTRAIT ? 2 : 5, gap = 14;
  const top = PORTRAIT ? 220 : 124;
  const bw = Math.min(PORTRAIT ? 320 : 220, (W - 40 - gap * (cols - 1)) / cols);
  const bh = PORTRAIT ? 104 : 96;
  for (let t = 1; t <= 10; t++) {
    const i = t - 1, r = Math.floor(i / cols), c = i % cols;
    const x = W / 2 - (cols * bw + (cols - 1) * gap) / 2 + c * (bw + gap), y = top + r * (bh + gap);
    const connue = L.tableConnue(sv.maitrise, t);
    bouton('as' + t, x, y, bw, bh, { texte: '×' + t, taille: bh * 0.36, police: 'titre', dy: -bh * 0.12, couleur: connue ? C.vert : C.cyan, sous: NOM_ASTUCE[t], tailleSous: Math.min(20, bw / 9), flou: 8 }, () => lancerCartes(t));
  }
  const rows = Math.ceil(10 / cols);
  const yb = top + rows * (bh + gap) + 10;
  const bw2 = Math.min(460, W - 40);
  bouton('difficiles', W / 2 - bw2 / 2, yb, bw2, 84, { texte: 'MES CARTES DIFFICILES', taille: Math.min(24, bw2 / 22), police: 'titre', couleur: C.rose, dy: -10, sous: 'les 10 que tu connais le moins', tailleSous: 18 }, () => lancerCartes(null));
}

function lancerCartes(table) {
  F = { table, cartes: L.paquet(sv.maitrise, table), i: 0, etape: table ? 'astuce' : 'devant', t: 0, flip: 0, sues: 0, vues: 0, rejouees: {}, resultats: [], tCarte: 0 };
  if (ecran === 'cartes') { tEcran = 0; S.sfx('whoosh'); } else aller('cartes');
}

function carteCourante() { return F.cartes[F.i]; }
function retourner() {
  if (F.etape !== 'devant' || F.flip > 0) return;
  F.secondes = F.tCarte;
  F.flip = 0.0001; S.sfx('whoosh');
}
function repondreCarte(savais) {
  const q = carteCourante();
  L.noter(sv.maitrise, q.a, q.b, savais, savais ? F.secondes : null);
  sauver();
  const k = L.cle(q.a, q.b);
  const premiere = !F.rejouees[k];
  if (savais) {
    if (premiere) F.sues++;
    S.sfx('parfait');
    if (F.secondes < 3) G.pop('ÉCLAIR !', W / 2, H * 0.3, { taille: 54, couleur: C.jaune, duree: 1.1 });
    G.eclat(W / 2, H * 0.45, 40, [C.vert, C.jaune, '#fff'], 600, { tourne: true, taille: 9, duree: 1 });
  } else {
    S.sfx('oh');
    // la carte revient un peu plus loin (deux fois au plus)
    F.rejouees[k] = (F.rejouees[k] || 0) + 1;
    if (F.rejouees[k] <= 2) F.cartes.splice(Math.min(F.i + 3, F.cartes.length), 0, { a: q.b, b: q.a });
  }
  if (premiere) { F.vues++; F.resultats.push(savais); }
  F.i++;
  if (F.i >= F.cartes.length) {
    F.etape = 'fin'; F.t = 0;
    const n = F.sues;
    setTimeout(() => { S.sfx(n >= 8 ? 'trophee' : 'parfait'); S.voix(n >= 9 ? 'parfait' : n >= 7 ? 'bravo' : 'super'); }, 300);
  } else { F.etape = 'devant'; F.flip = 0; F.t = 0; F.tCarte = 0; }
}

function dire(q) {
  try {
    if (!window.speechSynthesis) return;
    const x = L.astuce(q.a, q.b);
    const lisible = s2 => s2.replace(/×/g, ' fois ').replace(/−/g, ' moins ').replace(/→/g, ', ').replace(/=/g, ' égale ');
    const u = new SpeechSynthesisUtterance(lisible(`${q.a} × ${q.b} = ${x.resultat}. ${x.titre}. ${x.calcul}.`));
    u.lang = 'fr-FR'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}

function ecranCartes(dt) {
  if (!F) { ecran = 'astuces'; return; }
  F.t += dt;
  if (F.etape === 'devant' && !F.flip) F.tCarte += dt;
  if (F.flip > 0 && F.flip < 1) { F.flip = Math.min(1, F.flip + dt / 0.35); if (F.flip >= 1) F.etape = 'dos'; }
  boutonRetour(20, 20);
  const titre = F.table ? 'TABLE DE ' + F.table : 'CARTES DIFFICILES';
  G.texteFige(ctx, titre, W / 2, PORTRAIT ? 120 : 44, PORTRAIT ? 36 : 30, C.violet, { police: 'titre', lueur: C.violet, contour: '#1a0630' });
  if (F.etape === 'fin') return finCartes();

  // points de progression
  if (F.etape !== 'astuce') {
    const n = F.cartes.length, py = PORTRAIT ? 168 : 82, pas = Math.min(26, (W - 80) / n);
    for (let k = 0; k < n; k++) {
      const x = W / 2 + (k - (n - 1) / 2) * pas;
      ctx.fillStyle = k < F.i ? C.vert : k === F.i ? C.jaune : '#2a3070';
      ctx.fillRect(x - 6, py - 6, 12, 12);
    }
  }
  const cw = Math.min(W - 32, PORTRAIT ? 660 : 820), ch = PORTRAIT ? Math.min(H - 330, 1100) : H - 240;
  const cx = W / 2, cy = (PORTRAIT ? 200 : 104) + ch / 2;
  if (F.etape === 'astuce') return carteAstuceTable(cx, cy, cw, ch);

  const q = carteCourante();
  // entrée de la carte
  const entree = G.sortie(F.t * 4);
  const flipK = F.flip <= 0 ? 1 : Math.abs(Math.cos(Math.PI * F.flip));
  const dos = F.flip >= 0.5;
  ctx.save();
  ctx.translate(cx + (1 - entree) * W * 0.7, cy);
  ctx.scale(flipK, 1);
  G.rectNeon(ctx, -cw / 2, -ch / 2, cw, ch, dos ? C.vert : C.violet, { fond: dos ? 'rgba(8,30,40,0.95)' : 'rgba(22,14,64,0.95)', flou: 20, epaisseur: 4, coin: 16 });
  if (!dos) devantCarte(q, cw, ch); else dosCarte(q, cw, ch);
  ctx.restore();
  if (!dos) bouton('carte', cx - cw / 2, cy - ch / 2, cw, ch, { couleur: 'rgba(0,0,0,0)', fond: 'rgba(0,0,0,0)', flou: 0, epaisseur: 0.01 }, retourner);
  if (F.etape === 'dos' && window.speechSynthesis) bouton('ecouter', cx + cw / 2 - 70, cy + ch / 2 - 70, 56, 56, { couleur: C.violet, dessin: iconeHP }, () => dire(q));

  // boutons du bas
  const by = cy + ch / 2 + 18, bh = Math.min(84, H - by - 14);
  const bw = Math.min(300, (W - 48) / 2);
  if (F.etape === 'devant' && !F.flip) {
    bouton('retourner', W / 2 - Math.min(420, W - 40) / 2, by, Math.min(420, W - 40), bh, { texte: 'RETOURNER', taille: 28, police: 'titre', couleur: C.jaune, flou: 18 + Math.sin(temps * 5) * 6 }, retourner);
  } else if (F.etape === 'dos') {
    bouton('pasencore', W / 2 - bw - 8, by, bw, bh, { texte: 'PAS ENCORE', taille: Math.min(24, bw / 11), police: 'titre', couleur: '#ff9d3c' }, () => repondreCarte(false));
    bouton('savais', W / 2 + 8, by, bw, bh, { texte: 'JE SAVAIS !', taille: Math.min(24, bw / 11), police: 'titre', couleur: C.vert, flou: 20 }, () => repondreCarte(true));
  }
}

function devantCarte(q, cw, ch) {
  const ts = Math.min(cw / 5.2, 120);
  ctx.font = G.police('titre', ts);
  const parts = [[String(q.a), C.cyan], ['×', '#fff'], [String(q.b), C.rose]];
  const esp = ts * 0.4;
  const tot = parts.reduce((s2, p) => s2 + ctx.measureText(p[0]).width, 0) + esp * 2;
  let x = -tot / 2;
  for (const [s2, c] of parts) { G.texte(ctx, s2, x, -ch * 0.08, ts, c, { police: 'titre', align: 'left', lueur: c }); x += ctx.measureText(s2).width + esp; }
  G.texte(ctx, 'Combien de cochons dans la grange ?', 0, ch * 0.16, Math.min(28, cw / 22), '#cfe', {});
  G.texte(ctx, 'Réponds dans ta tête, puis retourne la carte', 0, ch * 0.26, Math.min(22, cw / 28), '#8f98d8', {});
  // petite barre de temps : un éclair si tu retournes vite
  const bw = cw * 0.6, k = Math.min(1, F.tCarte / 3);
  ctx.fillStyle = '#2a3070'; ctx.fillRect(-bw / 2, ch * 0.38, bw, 10);
  ctx.fillStyle = k < 1 ? C.jaune : '#5b63a8'; ctx.fillRect(-bw / 2, ch * 0.38, bw * (1 - k), 10);
}

function dosCarte(q, cw, ch) {
  const x = L.astuce(q.a, q.b);
  const large = !PORTRAIT && cw > 640;
  const colTexte = large ? -cw / 2 + cw * 0.26 : 0;
  const lt = large ? cw * 0.46 : cw - 48;
  let y = -ch / 2 + 56;
  const eq = `${q.a} × ${q.b} = ${x.resultat}`;
  const te = Math.min(64, 64 * lt / G.largeur(ctx, eq, 64, 'titre'));
  G.texte(ctx, eq, colTexte, y, te, C.vert, { police: 'titre', lueur: C.vert, contour: '#06102a' });
  y += te * 0.6 + 36;
  G.texte(ctx, x.titre, colTexte, y, Math.min(32, 32 * lt / G.largeur(ctx, x.titre, 32)), C.jaune, { lueur: C.jaune, flou: 8 });
  y += 48;
  const tc = Math.min(34, 34 * lt / G.largeur(ctx, x.calcul, 34, 'titre'));
  G.texte(ctx, x.calcul, colTexte, y, tc, '#fff', { police: 'titre' });
  y += tc + 22;
  for (const l of x.lignes) {
    const tl = Math.min(22, 22 * lt / G.largeur(ctx, l, 22));
    G.texte(ctx, l, colTexte, y, tl, '#cfe', {}); y += tl + 14;
  }
  // la grille découpée
  let zx, zy, zw, zh;
  if (large) { zx = 24; zy = -ch / 2 + 40; zw = cw / 2 - 40; zh = ch - 120; }
  else { zx = -cw / 2 + 20; zy = y + 6; zw = cw - 40; zh = ch / 2 - y - 20; }
  dessinerDecoupe(x, zx, zy, zw, zh);
}

function dessinerDecoupe(x, zx, zy, zw, zh) {
  if (zh < 60) return;
  const rangs = x.groupes.reduce((s2, g) => s2 + g.rangs, 0);
  const n = x.n;
  const c = Math.min(46, (zw - 90) / n, zh / rangs);
  const gw = c * n;
  const gx = zx + (zw - 90 - gw) / 2, gy = zy + (zh - c * rangs) / 2;
  const couleurs = [C.rose, C.cyan, C.jaune, C.vert];
  let r = 0;
  x.groupes.forEach((g, gi) => {
    const coul = couleurs[gi % couleurs.length];
    for (let j = 0; j < g.rangs; j++) {
      const enleve = x.retire && r + j >= rangs - x.retire;
      for (let i = 0; i < n; i++) {
        const px = gx + i * c, py = gy + (r + j) * c;
        if (enleve) G.dessiner(ctx, G.cochons.f_normal, px + 1, py + 1, c - 2, (c - 2) * 13 / 14, 0.5);
        else G.dessiner(ctx, G.cochons.normal, px + 1, py + 1, c - 2, (c - 2) * 13 / 14);
      }
      if (enleve) {
        ctx.strokeStyle = C.rouge; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(gx - 4, gy + (r + j + 0.5) * c); ctx.lineTo(gx + gw + 4, gy + (r + j + 0.5) * c); ctx.stroke();
        G.texte(ctx, '− ' + n, gx + gw + 14, gy + (r + j + 0.5) * c, Math.min(24, c * 0.7), C.rouge, { police: 'titre', align: 'left' });
      }
    }
    // accolade et total du groupe
    const y0 = gy + r * c, y1 = gy + (r + g.rangs) * c;
    ctx.strokeStyle = coul; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gx + gw + 4, y0 + 2); ctx.lineTo(gx + gw + 10, y0 + 2); ctx.lineTo(gx + gw + 10, y1 - 2); ctx.lineTo(gx + gw + 4, y1 - 2); ctx.stroke();
    const total = x.retire ? g.total - x.retire * n : g.total;
    if (x.groupes.length > 1 || x.retire) G.texte(ctx, String(x.retire ? g.total : total), gx + gw + 16, (y0 + y1) / 2, Math.min(26, c * 0.8), coul, { police: 'titre', align: 'left' });
    r += g.rangs;
  });
  // nombre de cochons par rangée
  G.texte(ctx, n + ' par rangée', gx + gw / 2, gy - 16, Math.min(20, c * 0.6), '#9aa3e0', {});
}

function carteAstuceTable(cx, cy, cw, ch) {
  const a = L.ASTUCES_TABLE[F.table];
  const entree = G.sortie(tEcran * 3);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(entree, entree);
  G.rectNeon(ctx, -cw / 2, -ch / 2, cw, ch, C.jaune, { fond: 'rgba(30,24,10,0.95)', flou: 22, epaisseur: 4, coin: 16 });
  G.texte(ctx, 'L\'ASTUCE', 0, -ch / 2 + 46, 30, C.jaune, { police: 'titre', lueur: C.jaune });
  const tt = Math.min(40, 40 * (cw - 40) / G.largeur(ctx, a.titre, 40));
  G.texte(ctx, a.titre, 0, -ch / 2 + 110, tt, '#fff', { lueur: C.jaune, flou: 8 });
  let y = -ch / 2 + 170;
  a.lignes.forEach((l, i) => {
    const t2 = Math.min(i === 1 ? 34 : 26, (i === 1 ? 34 : 26) * (cw - 40) / G.largeur(ctx, l, i === 1 ? 34 : 26, i === 1 ? 'titre' : 'texte'));
    G.texte(ctx, l, 0, y, t2, i === 1 ? C.cyan : '#dff', { police: i === 1 ? 'titre' : 'texte' });
    y += t2 + 26;
  });
  // exemple dessiné avec 7 (ou 8 pour la table de 7, 6 pour 8)
  const ex = F.table === 7 ? 6 : F.table === 8 ? 6 : F.table === 5 ? 8 : 7;
  if (F.table !== ex) dessinerDecoupe(L.astuce(F.table, ex), -cw / 2 + 30, y, cw - 60, ch / 2 - y - 20);
  ctx.restore();
  const by = cy + ch / 2 + 18, bh = Math.min(84, H - by - 14), bw = Math.min(420, W - 40);
  bouton('commencer', W / 2 - bw / 2, by, bw, bh, { texte: 'LES CARTES !', taille: 28, police: 'titre', couleur: C.vert, flou: 18 + Math.sin(temps * 5) * 6 }, () => { F.etape = 'devant'; F.t = 0; F.tCarte = 0; S.sfx('whoosh'); });
}

function finCartes() {
  const n = F.sues, tot = F.vues;
  const etoiles = n >= 10 ? 3 : n >= 8 ? 2 : n >= 5 ? 1 : 0;
  for (let i = 0; i < 3; i++) {
    const k = G.elastique(clamp((F.t - 0.4 - i * 0.3) * 2, 0, 1));
    const s2 = 100;
    ctx.save(); ctx.translate(W / 2 + (i - 1) * (s2 + 20), H * 0.32); ctx.scale(k, k);
    G.dessiner(ctx, G.etoile, -s2 / 2, -s2 / 2, s2, s2, i < etoiles ? 1 : 0.18);
    ctx.restore();
  }
  G.texte(ctx, `${n} sur ${tot} du premier coup !`, W / 2, H * 0.47, 34, '#fff', { lueur: C.cyan });
  G.texte(ctx, n >= 8 ? 'Maintenant, essaie dans la grange !' : 'Relis les astuces et recommence.', W / 2, H * 0.54, 26, C.jaune, {});
  const bw = Math.min(300, (W - 60) / 2), bh = 72, y = H * 0.62;
  bouton('encore', W / 2 - bw - 10, y, bw, bh, { texte: 'ENCORE', taille: 28, police: 'titre', couleur: C.violet }, () => lancerCartes(F.table));
  if (F.table) bouton('grange', W / 2 + 10, y, bw, bh, { texte: 'GRANGE', taille: 28, police: 'titre', couleur: C.vert }, () => lancerCourse({ mode: 'entrainement', table: F.table }));
  else bouton('autres', W / 2 + 10, y, bw, bh, { texte: 'ASTUCES', taille: 28, police: 'titre', couleur: C.cyan }, () => { ecran = 'astuces'; tEcran = 0; });
}

// =====================================================================
// MES TABLES
// =====================================================================
const COUL_NIV = ['#262d6e', '#ff3a5c', '#ff9d3c', '#45e07a', '#ffd23f'];
function ecranTables(dt) {
  boutonRetour(20, 20);
  const b = L.bilan(sv.maitrise);
  G.texteFige(ctx, 'MES TABLES', W / 2, PORTRAIT ? 120 : 44, PORTRAIT ? 40 : 34, C.cyan, { police: 'titre', lueur: C.cyan, contour: '#1a0630' });
  G.texte(ctx, `${b.connus} / ${b.total} connues   ★ ${b.etoiles} rapides`, W / 2, PORTRAIT ? 166 : 82, 24, '#dff', {});
  const top = PORTRAIT ? 200 : 104, bas = H - (PORTRAIT ? 140 : 70);
  const cs = Math.min((W - 60) / 11.4, (bas - top) / 11);
  const x0 = W / 2 - cs * 11.4 / 2, y0 = top;
  // en-tête colonnes
  for (let j = 1; j <= 10; j++) G.texte(ctx, String(j), x0 + cs * 1.4 + (j - 0.5) * cs, y0 + cs * 0.5, cs * 0.42, C.rose, { police: 'titre' });
  for (let i = 1; i <= 10; i++) {
    const y = y0 + i * cs;
    const connue = L.tableConnue(sv.maitrise, i);
    bouton('t' + i, x0, y + 2, cs * 1.3, cs - 4, { texte: '×' + i, taille: cs * (i === 10 ? 0.34 : 0.42), police: 'titre', couleur: connue ? C.vert : C.cyan, flou: 6 }, () => lancerCourse({ mode: 'entrainement', table: i }));
    for (let j = 1; j <= 10; j++) {
      const x = x0 + cs * 1.4 + (j - 1) * cs;
      const n = L.niveau(sv.maitrise[L.cle(i, j)]);
      const k = G.sortie((tEcran - (i + j) * 0.02) * 3);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = COUL_NIV[n]; ctx.globalAlpha = k * (n ? 0.85 : 0.6);
      ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      ctx.globalAlpha = k;
      if (n === 4) { ctx.shadowColor = C.jaune; ctx.shadowBlur = 10; ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4); ctx.shadowBlur = 0; }
      G.texte(ctx, String(i * j), x + cs / 2, y + cs / 2 + 1, cs * (i * j >= 100 ? 0.3 : 0.38), n ? '#0b0b2a' : '#8f98d8', { police: 'texte' });
      ctx.restore();
    }
  }
  // légende
  const leg = [['pas vu', 0], ['à revoir', 1], ['trouvé', 2], ['connu', 3], ['rapide ★', 4]];
  const ly = bas + (PORTRAIT ? 30 : 24);
  const lw = Math.min(150, (W - 40) / 5);
  leg.forEach(([t, n], i) => {
    const x = W / 2 + (i - 2) * lw;
    ctx.fillStyle = COUL_NIV[n]; ctx.fillRect(x - lw / 2 + 4, ly - 9, 18, 18);
    G.texte(ctx, t, x - lw / 2 + 28, ly, 18, '#cfe', { align: 'left' });
  });
  G.texte(ctx, 'Touche une table pour t\'entraîner !', W / 2, ly + (PORTRAIT ? 50 : 34), 22, C.jaune, {});
}

// =====================================================================
// BOUCLE
// =====================================================================
// Résolution interne plafonnée : le jeu est en gros pixels, inutile de dessiner en pleine définition.
const PLAFOND = [540, 680, 1000];   // plus petit côté du canvas, en pixels, selon la qualité
function redim() {
  const iw = window.innerWidth, ih = window.innerHeight;
  const k = Math.min(window.devicePixelRatio || 1, 2, PLAFOND[G.qualite] / Math.min(iw, ih));
  const cw = Math.floor(iw * k), ch = Math.floor(ih * k);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  ECH = Math.min(cw, ch) / 720;
  W = cw / ECH; H = ch / ECH;
  PORTRAIT = H > W * 1.05;
  G.grille.redim(W, H);
}

let dernier = performance.now();
function boucle(now) {
  requestAnimationFrame(boucle);
  let dt = (now - dernier) / 1000; dernier = now;
  if (dt > 0.1) dt = 0.1;
  temps += dt; tEcran += dt;
  redim();
  G.grille.maj(dt); G.majParticules(dt); G.majPops(dt);
  secousse = Math.max(0, secousse - dt * 30);
  flash = Math.max(0, flash - dt * 1.5);

  ctx.setTransform(ECH, 0, 0, ECH, 0, 0);
  ctx.imageSmoothingEnabled = false;
  boutons = [];
  fond(dt);
  ctx.save();
  if (secousse > 0) ctx.translate((Math.random() - 0.5) * secousse, (Math.random() - 0.5) * secousse);
  switch (ecran) {
    case 'titre': ecranTitre(dt); break;
    case 'coupes': ecranCoupes(dt); break;
    case 'depart': ecranDepart(dt); break;
    case 'course': ecranCourse(dt); break;
    case 'resultats': ecranResultats(dt); break;
    case 'tables': ecranTables(dt); break;
    case 'astuces': ecranAstuces(dt); break;
    case 'cartes': ecranCartes(dt); break;
  }
  G.dessinerParticules(ctx);
  G.dessinerPops(ctx);
  ctx.restore();
  if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = flashCouleur; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  // balayage façon écran cathodique (motif précalculé, seulement en qualité haute)
  if (G.qualite > 1) {
    if (!motifBalayage) {
      const m = document.createElement('canvas'); m.width = 4; m.height = 4;
      const mc = m.getContext('2d'); mc.fillStyle = 'rgba(0,0,0,0.12)'; mc.fillRect(0, 0, 4, 1.5);
      motifBalayage = ctx.createPattern(m, 'repeat');
    }
    ctx.fillStyle = motifBalayage; ctx.fillRect(0, 0, W, H);
  }
  surveillerFluidite(dt);
}
let motifBalayage = null;

// Si le téléphone n'arrive pas à suivre (moins de ~40 images/s pendant 2 s), on baisse la qualité d'un cran.
let mesureT = 0, mesureN = 0;
function surveillerFluidite(dt) {
  if (document.hidden || G.qualite === 0) return;
  mesureT += dt; mesureN++;
  if (mesureT >= 2) {
    const moy = mesureT / mesureN;
    mesureT = 0; mesureN = 0;
    if (moy > 1 / 40) { G.reglerQualite(ctx, G.qualite - 1); fondCache = null; console.info('qualité', G.qualite); }
  }
}

// ---------- Entrées ----------
function point(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width) / ECH, y: (e.clientY - r.top) * (cv.height / r.height) / ECH }; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  S.init();
  if (!bienvenueDite && ecran === 'titre') { bienvenueDite = true; setTimeout(() => S.voix('bienvenue'), 300); S.jouerMusique('menu'); }
  const p = point(e);
  for (let i = boutons.length - 1; i >= 0; i--) {
    const b = boutons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      if (!b.action) return;
      appui = { id: b.id, t: temps };
      if (!b.id.startsWith('k')) S.sfx('clic');
      G.grille.choc(p.x, p.y, 120, 160);
      G.eclat(p.x, p.y, 6, [C.cyan, '#fff'], 200, { grav: 0, duree: 0.3, taille: 5 });
      b.action();
      return;
    }
  }
  G.grille.choc(p.x, p.y, 160, 200);
});
window.addEventListener('keydown', e => {
  if (!document.getElementById('nom-boite').hidden) return;
  S.init();
  if (ecran === 'course' && R) {
    if (/^[0-9]$/.test(e.key)) { touche(e.key); appui = { id: 'k' + e.key, t: temps }; }
    else if (e.key === 'Backspace') { touche('del'); appui = { id: 'kdel', t: temps }; }
    else if (e.key === 'Enter') { touche('ok'); appui = { id: 'kok', t: temps }; }
    else if (e.key === 'Escape') R.pauseMenu = !R.pauseMenu;
    e.preventDefault();
  } else if (ecran === 'cartes' && F && (e.key === 'Enter' || e.key === ' ')) {
    if (F.etape === 'devant') retourner(); else if (F.etape === 'dos') repondreCarte(true); else if (F.etape === 'astuce') { F.etape = 'devant'; F.t = 0; F.tCarte = 0; }
    e.preventDefault();
  } else if (ecran === 'cartes' && F && F.etape === 'dos' && e.key === 'Backspace') { repondreCarte(false); e.preventDefault();
  } else if (e.key === 'Escape' && ecran !== 'titre') retour(false);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (ecran === 'course' && R && R.phase !== 'fin') R.pauseMenu = true; if (S.ctx) S.ctx.suspend(); }
  else if (S.ctx) S.ctx.resume();
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

function allerPleinEcran() {
  try {
    if (matchMedia('(pointer: coarse)').matches && document.fullscreenEnabled && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  } catch (e) {}
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
}

// ---------- Saisie du prénom (champ HTML par-dessus le jeu) ----------
function editerNom() {
  const boite = document.getElementById('nom-boite'), champ = document.getElementById('nom-champ');
  champ.value = sv.nom;
  boite.hidden = false;
  setTimeout(() => { champ.focus(); champ.select(); }, 50);
}
(function () {
  const boite = document.getElementById('nom-boite'), champ = document.getElementById('nom-champ');
  const fermer = () => { const n = champ.value.trim(); if (n) { sv.nom = n.slice(0, 14); sauver(); } boite.hidden = true; champ.blur(); };
  document.getElementById('nom-ok').addEventListener('click', fermer);
  document.getElementById('nom-form').addEventListener('submit', e => { e.preventDefault(); fermer(); });
  boite.addEventListener('pointerdown', e => { if (e.target === boite) fermer(); });
})();

// ---------- Démarrage ----------
charger();
G.init();
G.reglerQualite(ctx, matchMedia('(pointer: coarse)').matches ? 1 : 2);
try { history.replaceState({ e: 'titre' }, ''); } catch (e) {}
Promise.race([document.fonts ? document.fonts.load('40px PS2').then(() => document.fonts.load('700 40px PDC')) : Promise.resolve(), new Promise(r => setTimeout(r, 1500))])
  .finally(() => requestAnimationFrame(boucle));

// pour les tests automatiques
window.__jeu = { get F() { return F; }, lancerCartes, retourner, repondreCarte, get R() { return R; }, get ecran() { return ecran; }, lancerCourse, touche, aller, sv: () => sv, set choixCoupe(v) { choixCoupe = v; } };
})();
