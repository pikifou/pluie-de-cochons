// Sons : bruitages synthétisés (Web Audio), musiques en boucle, voix enregistrées.
(function () {
'use strict';
const A = {
  ctx: null, master: null, sfxBus: null, musBus: null, voiceBus: null,
  buffers: {}, musique: null, musiqueNom: null,
  volMusique: 0.7, volBruitages: 1,
  pret: false,
};

A.init = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  A.ctx = new AC();
  A.master = A.ctx.createGain(); A.master.gain.value = 0.9;
  const comp = A.ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 4;
  A.master.connect(comp); comp.connect(A.ctx.destination);
  A.sfxBus = A.ctx.createGain(); A.sfxBus.connect(A.master);
  A.musBus = A.ctx.createGain(); A.musBus.connect(A.master);
  A.voiceBus = A.ctx.createGain(); A.voiceBus.connect(A.master);
  A.appliquerVolumes();
  A.chargerTout();
};

A.appliquerVolumes = function () {
  if (!A.ctx) return;
  A.sfxBus.gain.value = 0.55 * A.volBruitages;
  A.voiceBus.gain.value = 1.1 * A.volBruitages;
  A.musBus.gain.setTargetAtTime(0.42 * A.volMusique * (A.duck || 1), A.ctx.currentTime, 0.08);
};

function b64ToBuf(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
async function charger(nom, src) {
  try {
    let ab;
    if (src.startsWith('data:')) ab = b64ToBuf(src);
    else ab = await (await fetch(src)).arrayBuffer();
    A.buffers[nom] = await new Promise((ok, ko) => A.ctx.decodeAudioData(ab, ok, ko));
  } catch (e) { console.warn('son', nom, e); }
}
A.chargerTout = async function () {
  const as = window.ASSETS || {};
  const jobs = [];
  for (const [k, v] of Object.entries(as.voix || {})) jobs.push(charger('v_' + k, v));
  for (const [k, v] of Object.entries(as.music || {})) jobs.push(charger('m_' + k, v));
  await Promise.all(jobs);
  A.pret = true;
  if (A.musiqueVoulue) A.jouerMusique(A.musiqueVoulue, true);
};

// ---------- Musique ----------
A.jouerMusique = function (nom, force) {
  A.musiqueVoulue = nom;
  if (!A.ctx) return;
  if (A.musiqueNom === nom && !force && A.musique) return;
  const buf = A.buffers['m_' + nom];
  if (!buf) return;
  const t = A.ctx.currentTime;
  if (A.musique) {
    const old = A.musique;
    old.g.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { try { old.s.stop(); } catch (e) {} }, 1500);
  }
  const s = A.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
  const g = A.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, t, 0.3);
  s.connect(g); g.connect(A.musBus); s.start();
  A.musique = { s, g }; A.musiqueNom = nom;
};
A.baisserMusique = function (f) { A.duck = f; A.appliquerVolumes(); };

// ---------- Voix ----------
let voixEnCours = null;
A.voix = function (nom) {
  if (!A.ctx || A.volBruitages <= 0) return;
  const buf = A.buffers['v_' + nom];
  if (!buf) return;
  if (voixEnCours) { try { voixEnCours.stop(); } catch (e) {} }
  const s = A.ctx.createBufferSource(); s.buffer = buf; s.connect(A.voiceBus); s.start();
  voixEnCours = s;
  A.baisserMusique(0.45);
  s.onended = () => { if (voixEnCours === s) { voixEnCours = null; A.baisserMusique(1); } };
};

// ---------- Bruitages synthétisés ----------
function env(g, t, a, d, v) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function osc(type, f, t, dur, vol, f2, dest) {
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, 0.005, dur, vol);
  o.connect(g); g.connect(dest || A.sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}
let bruitBuf = null;
function bruit(t, dur, vol, freq, q, type) {
  if (!bruitBuf) {
    bruitBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
    const d = bruitBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = A.ctx.createBufferSource(); s.buffer = bruitBuf;
  const f = A.ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
  const g = A.ctx.createGain(); env(g, t, 0.004, dur, vol);
  s.connect(f); f.connect(g); g.connect(A.sfxBus); s.start(t); s.stop(t + dur + 0.05);
}
const GAMME = [0, 2, 4, 7, 9]; // pentatonique
function note(i, base) { const o = Math.floor(i / 5), n = GAMME[((i % 5) + 5) % 5]; return base * Math.pow(2, (o * 12 + n) / 12); }

A.sfx = function (nom, p) {
  if (!A.ctx || A.volBruitages <= 0) return;
  const t = A.ctx.currentTime;
  switch (nom) {
    case 'touche': osc('square', 660 + (p || 0) * 30, t, 0.06, 0.18); break;
    case 'efface': osc('square', 300, t, 0.08, 0.15, 180); break;
    case 'valide': osc('square', 520, t, 0.07, 0.2); osc('square', 780, t + 0.06, 0.1, 0.2); break;
    case 'plop': { // un cochon atterrit, la note monte avec le compte
      const f = note(Math.min(p || 0, 40), 262);
      osc('square', f, t, 0.07, 0.13);
      osc('triangle', f / 2, t, 0.09, 0.2, f / 4);
      break;
    }
    case 'chute': osc('sine', 1400, t, 0.12, 0.04, 500); break;
    case 'rangee': osc('triangle', note(p || 0, 523), t, 0.18, 0.18); break;
    case 'toit': bruit(t, 0.35, 0.6, 180, 0.8, 'lowpass'); osc('sine', 110, t, 0.35, 0.6, 45); break;
    case 'parfait':
      [0, 2, 4, 7, 9, 12].forEach((n, i) => osc('square', 523 * Math.pow(2, n / 12), t + i * 0.06, 0.16, 0.14));
      osc('triangle', 1046, t + 0.36, 0.5, 0.18);
      break;
    case 'faux':
      osc('sawtooth', 220, t, 0.18, 0.18, 150); osc('sawtooth', 160, t + 0.17, 0.3, 0.18, 90);
      break;
    case 'coeur': // le coeur se brise
      bruit(t, 0.25, 0.5, 3000, 0.7); osc('square', 880, t, 0.25, 0.12, 110);
      break;
    case 'ejecte': osc('square', 400, t, 0.15, 0.08, 1600); break;
    case 'bip': osc('square', 440, t, 0.18, 0.22); break;
    case 'go': osc('square', 880, t, 0.5, 0.22); osc('square', 1320, t, 0.5, 0.08); break;
    case 'whoosh': bruit(t, 0.3, 0.25, 900, 0.6); break;
    case 'trophee':
      [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => osc('square', 392 * Math.pow(2, n / 12), t + i * 0.11, 0.2, 0.14));
      osc('triangle', 392 * 4, t + 0.8, 0.9, 0.16);
      break;
    case 'clic': osc('square', 900, t, 0.04, 0.12); break;
    case 'tic': osc('square', 1200, t, 0.02, 0.05); break;
    case 'depasse': osc('square', 700, t, 0.06, 0.1); osc('square', 1050, t + 0.05, 0.08, 0.1); break;
    case 'oh': osc('triangle', 330, t, 0.25, 0.2, 220); break;
  }
};

window.Son = A;
})();
