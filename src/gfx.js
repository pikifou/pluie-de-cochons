// Graphismes : sprites en pixels, grille élastique façon arcade néon, particules, textes.
(function () {
'use strict';
const G = {};

// ---------- Sprites pixel ----------
function pad(rows) { const w = Math.max(...rows.map(r => r.length)); return rows.map(r => r.padEnd(w, '.')); }
function sprite(rows, pal) {
  rows = pad(rows);
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i];
    if (ch === '.' || !pal[ch]) continue;
    x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1);
  }
  return c;
}
G.sprite = sprite;

const COCHON = {
  normal: [
    '.DD........DD.',
    'DPPDDDDDDDDPPD',
    'DPPPPPPPPPPPPD',
    'DPWPPPPPPPPPPD',
    'DPPKKPPPPKKPPD',
    'DPPKKPPPPKKPPD',
    'DPPPPPPPPPPPPD',
    'DPPSSSSSSSSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSSSSSSSSPPD',
    'DPPPPPPPPPPPPD',
    'DDDDDDDDDDDDDD',
  ],
  cligne: [
    '.DD........DD.',
    'DPPDDDDDDDDPPD',
    'DPPPPPPPPPPPPD',
    'DPWPPPPPPPPPPD',
    'DPPPPPPPPPPPPD',
    'DPPKKPPPPKKPPD',
    'DPPPPPPPPPPPPD',
    'DPPSSSSSSSSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSSSSSSSSPPD',
    'DPPPPPPPPPPPPD',
    'DDDDDDDDDDDDDD',
  ],
  content: [
    '.DD........DD.',
    'DPPDDDDDDDDPPD',
    'DPPPPPPPPPPPPD',
    'DPWPPPPPPPPPPD',
    'DPPKKPPPPKKPPD',
    'DPKPPKPPKPPKPD',
    'DPPPPPPPPPPPPD',
    'DRPSSSSSSSSPRD',
    'DPPSNSSSSNSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSSSSSSSSPPD',
    'DPPPPPPPPPPPPD',
    'DDDDDDDDDDDDDD',
  ],
  surpris: [
    '.DD........DD.',
    'DPPDDDDDDDDPPD',
    'DPKKPPPPPPKKPD',
    'DPPPPPPPPPPPPD',
    'DPKKKPPPPKKKPD',
    'DPKWKPPPPKWKPD',
    'DPKKKPPPPKKKPD',
    'DPPSSSSSSSSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSNSSSSNSPPD',
    'DPPSSSSSSSSPPD',
    'DPPPPPPPPPPPPD',
    'DDDDDDDDDDDDDD',
  ],
};
const PAL_ROSE = { D: '#d4527f', P: '#ffb6cb', W: '#fff0f5', K: '#2b0718', S: '#ff4f8b', N: '#7d0c35', R: '#ff86a8' };
const PAL_FANTOME = { D: '#bffcff', P: 'rgba(77,243,255,0.18)', W: 'rgba(255,255,255,0.4)', K: '#bffcff', S: 'rgba(77,243,255,0.35)', N: '#bffcff', R: 'rgba(77,243,255,0.3)' };
const PAL_OR = { D: '#c98a00', P: '#ffe27a', W: '#fffbe0', K: '#3a2200', S: '#ffb300', N: '#7a4a00', R: '#ffc94d' };

G.cochons = {};
G.cochonsHalo = {};
// Qualité : 2 = halos en temps réel ; 1 et 0 = halos coupés (trop lents sur téléphone)
G.qualite = 2;
G.reglerQualite = function (ctx, q) {
  G.qualite = q;
  if (q < 2) Object.defineProperty(ctx, 'shadowBlur', { configurable: true, set() {}, get() { return 0; } });
  else delete ctx.shadowBlur;
};
const HALO = 5; // marge du halo, en pixels du sprite
function avecHalo(spr, couleur) {
  const k = 6, c = document.createElement('canvas');
  c.width = (spr.width + HALO * 2) * k; c.height = (spr.height + HALO * 2) * k;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.shadowColor = couleur; x.shadowBlur = 10 * k / 4;
  x.drawImage(spr, HALO * k, HALO * k, spr.width * k, spr.height * k);
  return c;
}
// dessine un cochon avec son halo précalculé (une seule image, pas de flou à chaque image)
G.cochon = function (ctx, face, x, y, w, h) {
  const spr = G.cochonsHalo[face];
  if (!spr) return G.dessiner(ctx, G.cochons[face], x, y, w, h);
  const mx = w * HALO / 14, my = h * HALO / 13;
  G.dessiner(ctx, spr, x - mx, y - my, w + mx * 2, h + my * 2);
};
G.init = function () {
  for (const k of Object.keys(COCHON)) {
    G.cochons[k] = sprite(COCHON[k], PAL_ROSE);
    G.cochons['f_' + k] = sprite(COCHON[k], PAL_FANTOME);
    G.cochons['o_' + k] = sprite(COCHON[k], PAL_OR);
    G.cochonsHalo[k] = avecHalo(G.cochons[k], '#ff5cae');
  }
  G.coeur = sprite([
    '..RR...RR..',
    '.RWRR.RRRR.',
    'RRWRRRRRRRR',
    'RRRRRRRRRRR',
    'RRRRRRRRRRD',
    '.RRRRRRRRD.',
    '..RRRRRRD..',
    '...RRRRD...',
    '....RRD....',
    '.....D.....',
  ], { R: '#ff2a4f', W: '#ffc2cc', D: '#b3002a' });
  G.coeurVide = sprite([
    '..RR...RR..',
    '.R..R.R..R.',
    'R....R....R',
    'R.........R',
    'R.........R',
    '.R.......R.',
    '..R.....R..',
    '...R...R...',
    '....R.R....',
    '.....R.....',
  ], { R: '#5a3a6e' });
  const coupeRows = [
    '..GGGGGGGGGGGG..',
    'GGGLLGGGGGGGGGGD',
    'G.GLGGGGGGGGGD.D',
    'G.GLGGGGGGGGGD.D',
    '.GGLGGGGGGGGGDD.',
    '...GLGGGGGGGD...',
    '....GLGGGGGD....',
    '.....GGGGGD.....',
    '......GGGD......',
    '.......GD.......',
    '.......GD.......',
    '......GGGD......',
    '.....GLGGGD.....',
    '....DDDDDDDD....',
    '....DDDDDDDD....',
  ];
  G.trophees = {
    1: sprite(coupeRows, { G: '#ffd23f', L: '#fff6b0', D: '#c98a00' }),
    2: sprite(coupeRows, { G: '#cfd9e6', L: '#ffffff', D: '#7d8ea6' }),
    3: sprite(coupeRows, { G: '#e3884a', L: '#ffc59a', D: '#8f4a1b' }),
    0: sprite(coupeRows, { G: '#2a2a55', L: '#3a3a70', D: '#20204a' }),
  };
  G.coupeCouleur = c => sprite(coupeRows, { G: c, L: '#ffffff', D: 'rgba(0,0,0,0.35)' });
  G.etoile = sprite([
    '...Y...',
    '...Y...',
    'YYYYYYY',
    '.YYYYY.',
    '..YYY..',
    '.YY.YY.',
    'YY...YY',
  ], { Y: '#ffd23f' });
  G.cadenas = sprite([
    '..CCCC..',
    '.C....C.',
    '.C....C.',
    'LLLLLLLL',
    'LLLKKLLL',
    'LLLKKLLL',
    'LLLLLLLL',
  ], { C: '#9aa7d6', L: '#5b6bb0', K: '#141433' });
  G.drapeau = sprite([
    'PWKWKWK',
    'PKWKWKW',
    'PWKWKWK',
    'PKWKWKW',
    'P......',
    'P......',
    'P......',
  ], { P: '#bffcff', W: '#ffffff', K: '#111122' });
  // portraits (images générées puis pixelisées)
  G.portraits = {};
  const imgs = (window.ASSETS && window.ASSETS.img) || {};
  for (const [k, src] of Object.entries(imgs)) { const im = new Image(); im.src = src; G.portraits[k] = im; }
};

G.dessiner = function (ctx, spr, x, y, w, h, alpha) {
  if (!spr) return;
  ctx.imageSmoothingEnabled = false;
  if (alpha != null) { const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(spr, x, y, w, h); ctx.globalAlpha = a; }
  else ctx.drawImage(spr, x, y, w, h);
};
G.portrait = function (ctx, id, x, y, s, alpha) {
  const im = G.portraits[id];
  if (!im || !im.complete || !im.naturalWidth) { ctx.fillStyle = '#334'; ctx.fillRect(x, y, s, s); return; }
  G.dessiner(ctx, im, x, y, s, s, alpha);
};

// ---------- Couleurs ----------
G.C = {
  fond: '#070a24', fond2: '#0d1240', cyan: '#4df3ff', rose: '#ff5cae', rosePale: '#ffb6cb', jaune: '#ffe14d',
  vert: '#6dff8f', rouge: '#ff3a5c', violet: '#9b6bff', blanc: '#ffffff', gris: '#7d86c9', nuit: '#141a52',
};

// ---------- Grille élastique (fond) ----------
const Grille = { pas: 48, cols: 0, rows: 0, px: null, py: null, vx: null, vy: null, rx: null, ry: null, W: 0, H: 0 };
G.grille = Grille;
Grille.redim = function (W, H) {
  if (Math.abs(W - Grille.W) < 1 && Math.abs(H - Grille.H) < 1) return;
  Grille.W = W; Grille.H = H;
  Grille.cols = Math.ceil(W / Grille.pas) + 3; Grille.rows = Math.ceil(H / Grille.pas) + 3;
  const n = Grille.cols * Grille.rows;
  Grille.px = new Float32Array(n); Grille.py = new Float32Array(n); Grille.vx = new Float32Array(n); Grille.vy = new Float32Array(n);
  Grille.rx = new Float32Array(n); Grille.ry = new Float32Array(n);
  const ox = (W - (Grille.cols - 1) * Grille.pas) / 2, oy = (H - (Grille.rows - 1) * Grille.pas) / 2;
  for (let j = 0; j < Grille.rows; j++) for (let i = 0; i < Grille.cols; i++) {
    const k = j * Grille.cols + i;
    Grille.px[k] = Grille.rx[k] = ox + i * Grille.pas;
    Grille.py[k] = Grille.ry[k] = oy + j * Grille.pas;
  }
};
// impulsion radiale (force > 0 : pousse ; < 0 : aspire)
Grille.choc = function (x, y, force, rayon) {
  if (!Grille.px) return;
  const r2 = rayon * rayon;
  for (let k = 0; k < Grille.px.length; k++) {
    const dx = Grille.px[k] - x, dy = Grille.py[k] - y, d2 = dx * dx + dy * dy;
    if (d2 > r2 || d2 < 1) continue;
    const d = Math.sqrt(d2), f = force * (1 - d / rayon);
    Grille.vx[k] += dx / d * f; Grille.vy[k] += dy / d * f;
  }
};
Grille.maj = function (dt) {
  if (!Grille.px) return;
  const C = Grille.cols, R = Grille.rows, k1 = 60, k2 = 30, amort = Math.exp(-4.5 * dt);
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const k = j * C + i;
    let ax = (Grille.rx[k] - Grille.px[k]) * k1, ay = (Grille.ry[k] - Grille.py[k]) * k1;
    if (i > 0 && i < C - 1 && j > 0 && j < R - 1) {
      const mx = (Grille.px[k - 1] + Grille.px[k + 1] + Grille.px[k - C] + Grille.px[k + C]) / 4;
      const my = (Grille.py[k - 1] + Grille.py[k + 1] + Grille.py[k - C] + Grille.py[k + C]) / 4;
      ax += (mx - Grille.px[k] - (Grille.rx[k] - (Grille.rx[k - 1] + Grille.rx[k + 1]) / 2) * 0) * k2;
      ay += (my - Grille.py[k]) * k2;
    }
    Grille.vx[k] = (Grille.vx[k] + ax * dt) * amort;
    Grille.vy[k] = (Grille.vy[k] + ay * dt) * amort;
  }
  for (let k = 0; k < Grille.px.length; k++) { Grille.px[k] += Grille.vx[k] * dt; Grille.py[k] += Grille.vy[k] * dt; }
};
Grille.dessiner = function (ctx, couleur, t) {
  if (!Grille.px) return;
  const C = Grille.cols, R = Grille.rows;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = couleur || 'rgba(60,110,255,0.22)';
  ctx.beginPath();
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < C; i++) { const k = j * C + i; if (i === 0) ctx.moveTo(Grille.px[k], Grille.py[k]); else ctx.lineTo(Grille.px[k], Grille.py[k]); }
  }
  for (let i = 0; i < C; i++) {
    for (let j = 0; j < R; j++) { const k = j * C + i; if (j === 0) ctx.moveTo(Grille.px[k], Grille.py[k]); else ctx.lineTo(Grille.px[k], Grille.py[k]); }
  }
  ctx.stroke();
  // noeuds qui bougent : petits points lumineux
  ctx.fillStyle = 'rgba(120,200,255,0.5)';
  for (let k = 0; k < Grille.px.length; k++) {
    const dx = Grille.px[k] - Grille.rx[k], dy = Grille.py[k] - Grille.ry[k];
    const e = Math.min(1, (dx * dx + dy * dy) / 120);
    if (e > 0.05) { const s = 2 + e * 3; ctx.globalAlpha = e; ctx.fillRect(Grille.px[k] - s / 2, Grille.py[k] - s / 2, s, s); }
  }
  ctx.restore();
};

// ---------- Particules (carrés de pixels) ----------
const parts = [];
G.particules = parts;
G.eclat = function (x, y, n, couleurs, vitesse, opts) {
  opts = opts || {};
  for (let i = 0; i < n; i++) {
    const a = opts.angle != null ? opts.angle + (Math.random() - 0.5) * (opts.cone || 1) : Math.random() * Math.PI * 2;
    const v = vitesse * (0.3 + Math.random() * 0.9);
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      vie: 0, duree: (opts.duree || 0.8) * (0.5 + Math.random()),
      taille: (opts.taille || 6) * (0.6 + Math.random() * 0.8),
      couleur: couleurs[(Math.random() * couleurs.length) | 0],
      grav: opts.grav != null ? opts.grav : 600, frot: opts.frot || 1.5,
      tourne: opts.tourne || false, rot: Math.random() * 6,
    });
  }
};
G.majParticules = function (dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vie += dt;
    if (p.vie >= p.duree) { parts.splice(i, 1); continue; }
    const f = Math.exp(-p.frot * dt);
    p.vx *= f; p.vy = p.vy * f + p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 8;
  }
  if (parts.length > 1400) parts.splice(0, parts.length - 1400);
};
G.dessinerParticules = function (ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    const k = 1 - p.vie / p.duree;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.fillStyle = p.couleur;
    const s = p.taille * (0.4 + 0.6 * k);
    if (p.tourne) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore();
    } else ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  }
  ctx.restore();
};

// ---------- Textes qui sautent ----------
const pops = [];
G.pops = pops;
G.pop = function (texte, x, y, opts) {
  opts = opts || {};
  pops.push({ texte, x, y, vie: 0, bande: opts.bande || null, duree: opts.duree || 1.4, taille: opts.taille || 60, couleur: opts.couleur || G.C.jaune, monte: opts.monte != null ? opts.monte : 60, police: opts.police || 'titre', contour: opts.contour || '#1a0630' });
};
G.majPops = function (dt) { for (let i = pops.length - 1; i >= 0; i--) { pops[i].vie += dt; if (pops[i].vie > pops[i].duree) pops.splice(i, 1); } };
G.dessinerPops = function (ctx) {
  for (const p of pops) {
    const t = p.vie / p.duree;
    const e = t < 0.15 ? G.elastique(t / 0.15) : 1;
    const a = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    if (p.bande) {
      ctx.fillStyle = 'rgba(6,4,30,0.82)';
      const bh = p.taille * 2.1 * Math.min(1, t * 8);
      ctx.fillRect(p.bande.x, p.y - bh / 2, p.bande.w, bh);
      ctx.fillStyle = p.couleur; ctx.globalAlpha = a * 0.9;
      ctx.fillRect(p.bande.x, p.y - bh / 2, p.bande.w, 3); ctx.fillRect(p.bande.x, p.y + bh / 2 - 3, p.bande.w, 3);
      ctx.globalAlpha = a;
    }
    ctx.translate(p.x, p.y - p.monte * t);
    ctx.scale(e, e);
    G.texte(ctx, p.texte, 0, 0, p.taille, p.couleur, { police: p.police, contour: p.contour, lueur: p.couleur });
    ctx.restore();
  }
};

// ---------- Texte ----------
G.police = function (type, taille) {
  return type === 'titre' ? `${taille}px PS2, "Courier New", monospace` : `700 ${taille}px PDC, "Trebuchet MS", sans-serif`;
};
// Textes figés (logos, titres) : rendus une fois dans une image, avec leur halo, puis simplement recopiés.
const cacheTextes = new Map();
G.texteFige = function (ctx, s, x, y, taille, couleur, o) {
  o = o || {};
  const echelle = ctx.getTransform().a;
  const cle = [s, taille, couleur, o.police, o.contour, o.lueur, o.epaisseur, echelle.toFixed(2)].join('|');
  let im = cacheTextes.get(cle);
  if (!im) {
    const m = document.createElement('canvas').getContext('2d');
    const larg = G.largeur(m, s, taille, o.police) + taille * 1.6;
    const haut = taille * 2.6;
    m.canvas.width = Math.ceil(larg * echelle); m.canvas.height = Math.ceil(haut * echelle);
    m.setTransform(echelle, 0, 0, echelle, 0, 0);
    G.texte(m, s, larg / 2, haut / 2, taille, couleur, Object.assign({}, o, { align: 'center' }));
    im = { c: m.canvas, larg, haut };
    if (cacheTextes.size > 300) cacheTextes.clear();
    cacheTextes.set(cle, im);
  }
  let dx = -im.larg / 2;
  if (o.align === 'left') dx = -taille * 0.8; else if (o.align === 'right') dx = -im.larg + taille * 0.8;
  ctx.drawImage(im.c, x + dx, y - im.haut / 2, im.larg, im.haut);
};
G.texte = function (ctx, s, x, y, taille, couleur, o) {
  o = o || {};
  let police = o.police || 'texte';
  // les chiffres de la police « texte » se confondent (5/S, 2/8) : on écrit les nombres en police titre
  if (police === 'texte' && /[0-9]/.test(s)) { police = 'titre'; taille *= 0.74; }
  // la police titre n'a pas les majuscules accentuées
  if (police === 'titre') s = s.replace(/[ÉÈÊË]/g, 'E').replace(/[ÀÂ]/g, 'A').replace(/[ÎÏ]/g, 'I').replace(/Ç/g, 'C').replace(/Ô/g, 'O').replace(/[ÙÛ]/g, 'U').replace(/Œ/g, 'OE');
  ctx.font = G.police(police, taille);
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'middle';
  if (o.contour) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.epaisseur || Math.max(3, taille * 0.16);
    ctx.strokeStyle = o.contour;
    ctx.strokeText(s, x, y + taille * 0.06);
    ctx.strokeText(s, x, y);
  }
  if (o.lueur) { ctx.shadowColor = o.lueur; ctx.shadowBlur = o.flou || taille * 0.35; }
  ctx.fillStyle = couleur;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
};
G.largeur = function (ctx, s, taille, police) { ctx.font = G.police(police || 'texte', taille); return ctx.measureText(s).width; };

// ---------- Formes néon ----------
G.rectNeon = function (ctx, x, y, w, h, couleur, opts) {
  opts = opts || {};
  ctx.save();
  if (opts.fond) { ctx.fillStyle = opts.fond; ctx.fillRect(x, y, w, h); }
  ctx.strokeStyle = couleur; ctx.lineWidth = opts.epaisseur || 3;
  const flou = opts.flou != null ? opts.flou : 14;
  if (G.qualite < 2 && flou > 0) {
    // halo bon marché : un trait large et transparent sous le trait net
    ctx.globalAlpha *= 0.28; ctx.lineWidth = (opts.epaisseur || 3) * 3.2;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha /= 0.28; ctx.lineWidth = opts.epaisseur || 3;
  }
  ctx.shadowColor = couleur; ctx.shadowBlur = flou;
  ctx.strokeRect(x, y, w, h);
  if (opts.coins !== false) {
    // petits coins en pixels, style arcade
    const c = opts.coin || 8; ctx.fillStyle = couleur; ctx.shadowBlur = 0;
    ctx.fillRect(x - 2, y - 2, c, 4); ctx.fillRect(x - 2, y - 2, 4, c);
    ctx.fillRect(x + w - c + 2, y - 2, c, 4); ctx.fillRect(x + w - 2, y - 2, 4, c);
    ctx.fillRect(x - 2, y + h - 2, c, 4); ctx.fillRect(x - 2, y + h - c + 2, 4, c);
    ctx.fillRect(x + w - c + 2, y + h - 2, c, 4); ctx.fillRect(x + w - 2, y + h - c + 2, 4, c);
  }
  ctx.restore();
};

// ---------- Courbes ----------
G.elastique = function (t) { if (t <= 0) return 0; if (t >= 1) return 1; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
G.sortie = function (t) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); };
G.rebond = function (t) {
  t = Math.min(1, Math.max(0, t));
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

window.Gfx = G;
})();
