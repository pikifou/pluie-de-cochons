"""Le son réglé par Ludiworld : python tests/son.py [dossier_captures]

Sert docs/ en http (port 7383), ouvre le jeu dans Chromium (Playwright, muet, voix du navigateur remplacée)
et vérifie, sans rien écouter (l'écoute revient à un humain) :
- au premier lancement, musique, bruitages et voix sont allumés ; la musique tourne sur l'écran titre et en course ;
- chaque bouton (musique, haut-parleur, voix) ne coupe que sa part, et le réglage passe par le kit (ludi.v1.son) ;
- la voix éteinte : plus de bouton « écouter » sur les cartes ;
- Ludi.reglerSon et un message « ludi:son » du launcher sont suivis ; le bouton du jeu prévient le launcher ;
- une vieille sauvegarde avec la musique à 0 ne rend pas le jeu muet.
La musique est jouée en Web Audio : on lit le gain du bus de musique (et du bus des bruitages), pas un élément <audio>.
Plein, ce gain vaut 0,29 ; 0,13 pendant une voix (la musique se baisse) ; coupé, presque 0.
"""
import sys, os, json, asyncio, pathlib, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
ICI = pathlib.Path(__file__).resolve().parent.parent
OUT = sys.argv[1] if len(sys.argv) > 1 else None
PORT = 7383
BASE = f'http://localhost:{PORT}'

# Un faux launcher, à la même adresse (le kit accepte localhost) : il garde les messages reçus du jeu.
LANCEUR = b"""<!doctype html><meta charset="utf-8"><title>lanceur</title>
<body style="margin:0"><iframe id="jeu" src="/index.html" style="border:0;width:390px;height:844px"></iframe>
<script>window.recus = []; addEventListener('message', e => { if (e.data && e.data.type) window.recus.push(e.data); });</script></body>"""

class Servir(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/lanceur.html'):
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(LANCEUR))); self.end_headers(); self.wfile.write(LANCEUR); return
        return super().do_GET()
    def log_message(self, *a): pass

# Les navigateurs de test sont muets ; la voix du navigateur est remplacée par un compteur.
MUET = """(() => {
  window.__dits = [];
  try { speechSynthesis.speak = u => window.__dits.push(u.text); speechSynthesis.cancel = () => {}; } catch (e) {}
})();"""

ETAT = """(() => { const S = window.Son; return {
  son: window.__jeu.son, kit: window.Ludi.son(), ecran: window.__jeu.ecran,
  ctx: S.ctx ? S.ctx.state : null, pret: S.pret, musique: S.musiqueNom, joue: !!S.musique,
  gMus: S.musBus ? S.musBus.gain.value : null, gSfx: S.sfxBus ? S.sfxBus.gain.value : null, gVoix: S.voiceBus ? S.voiceBus.gain.value : null,
  stocke: JSON.parse(localStorage.getItem('ludi.v1.son') || 'null'), dits: window.__dits.length }; })()"""

ok = []
def verifier(cond, msg, etat=None):
    if not cond:
        raise AssertionError(msg + ('\n  ' + json.dumps(etat, ensure_ascii=False) if etat else ''))
    ok.append(msg); print('ok :', msg)

# Coordonnées : le jeu dessine dans un repère où le plus petit côté vaut 720.
def ecran_xy(pg, x, y):
    vw, vh = pg.viewport_size['width'], pg.viewport_size['height']
    k = min(vw, vh) / 720
    return x * k, y * k
def logique_wh(pg):
    vw, vh = pg.viewport_size['width'], pg.viewport_size['height']
    k = 720 / min(vw, vh)
    return vw * k, vh * k
async def toucher(pg, x, y):
    await pg.mouse.click(*ecran_xy(pg, x, y))
    await pg.wait_for_timeout(400)
async def bouton_son(pg, i):
    # 0 musique, 1 haut-parleur (bruitages), 2 voix : en bas à gauche de l'écran titre
    W, H = logique_wh(pg)
    await toucher(pg, 20 + i * 76 + 32, H - 84 + 32)

async def attendre_musique(pg, frame=None):
    f = frame or pg
    await f.wait_for_function("window.Son && window.Son.pret && window.Son.musique", timeout=10000)
    await pg.wait_for_timeout(900)   # le gain de la musique monte en douceur
    return await f.evaluate(ETAT)

async def nouvelle_page(b, avant=None):
    c = await b.new_context(viewport={'width': 390, 'height': 844})
    await c.add_init_script(MUET)
    if avant: await c.add_init_script(avant)
    pg = await c.new_page()
    erreurs = []
    pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' else None)
    return c, pg, erreurs

async def main():
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Servir, directory=str(ICI / 'docs')))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--mute-audio'])

            # 1. Premier lancement : tout allumé, musique sur l'écran titre puis en course
            c, pg, erreurs = await nouvelle_page(b)
            await pg.goto(BASE + '/index.html')
            await pg.wait_for_timeout(1200)
            e = await pg.evaluate(ETAT)
            verifier(e['son'] == {'musique': True, 'bruitages': True, 'voix': True} and e['kit'] == e['son'], 'premier lancement : tout allumé', e)
            await toucher(pg, 360, 300)   # un toucher dans le vide sur l'écran titre lance la musique
            e = await attendre_musique(pg)
            verifier(e['ctx'] == 'running' and e['musique'] == 'menu' and e['gMus'] > 0.1 and e['gSfx'] > 0.2, 'la musique du menu joue sur l\'écran titre', e)
            if OUT: await pg.screenshot(path=f'{OUT}/son-01-titre.png')

            # 2. Chaque bouton ne coupe que sa part
            await bouton_son(pg, 0)
            await pg.wait_for_timeout(600)
            e = await pg.evaluate(ETAT)
            verifier(not e['son']['musique'] and e['son']['bruitages'] and e['son']['voix'] and e['gMus'] < 0.02 and e['gSfx'] > 0.2
                     and e['stocke'] and e['stocke']['musique'] is False, 'bouton musique : coupe seulement la musique, réglage gardé par le kit', e)
            if OUT: await pg.screenshot(path=f'{OUT}/son-02-musique-coupee.png')
            await bouton_son(pg, 0)
            await pg.wait_for_timeout(600)
            e = await pg.evaluate(ETAT)
            verifier(e['son']['musique'] and e['gMus'] > 0.1, 'bouton musique : la rallume', e)
            await bouton_son(pg, 1)
            await pg.wait_for_timeout(600)
            e = await pg.evaluate(ETAT)
            verifier(not e['son']['bruitages'] and e['son']['musique'] and e['son']['voix'] and e['gSfx'] == 0 and e['gVoix'] == 0 and e['gMus'] > 0.1,
                     'bouton haut-parleur : coupe bruitages et exclamations, pas la musique', e)
            await bouton_son(pg, 2)
            e = await pg.evaluate(ETAT)
            verifier(not e['son']['voix'] and not e['son']['bruitages'] and e['son']['musique'] and e['stocke']['voix'] is False, 'bouton voix : coupe seulement la voix', e)
            if OUT: await pg.screenshot(path=f'{OUT}/son-03-bruitages-voix-coupes.png')
            await bouton_son(pg, 1)
            e = await pg.evaluate(ETAT)
            verifier(e['son'] == {'musique': True, 'bruitages': True, 'voix': False}, 'bouton haut-parleur : rallume les bruitages', e)

            # 3. La voix qui lit les astuces : pas de bouton « écouter » quand elle est éteinte
            W, H = logique_wh(pg)
            cw, ch = min(W - 32, 660), min(H - 330, 1100)
            ex, ey = W / 2 + cw / 2 - 70 + 28, 200 + ch / 2 + ch / 2 - 70 + 28
            await pg.evaluate("window.__jeu.lancerCartes(null)")
            await pg.wait_for_timeout(500)
            await pg.evaluate("window.__jeu.retourner()")
            await pg.wait_for_timeout(700)
            await toucher(pg, ex, ey)
            e = await pg.evaluate(ETAT)
            verifier(e['dits'] == 0, 'voix éteinte : pas de bouton écouter, rien n\'est lu', e)
            if OUT: await pg.screenshot(path=f'{OUT}/son-04-carte-sans-ecouter.png')
            await pg.evaluate("window.Ludi.reglerSon({ voix: true })")
            await pg.wait_for_timeout(200)
            await toucher(pg, ex, ey)
            e = await pg.evaluate(ETAT)
            verifier(e['son']['voix'] and e['dits'] == 1, 'Ludi.reglerSon({voix:true}) : le bouton écouter revient et lit l\'astuce', e)
            if OUT: await pg.screenshot(path=f'{OUT}/son-05-carte-ecouter.png')

            # 4. La musique de course
            await pg.evaluate("window.__jeu.lancerCourse({ mode: 'entrainement', table: 3 })")
            await pg.wait_for_timeout(1500)
            e = await pg.evaluate(ETAT)
            verifier(e['ecran'] == 'course' and e['musique'] == 'course' and e['gMus'] > 0.1, 'la musique de course joue en course', e)
            await pg.evaluate("window.Ludi.reglerSon({ musique: false })")
            await pg.wait_for_timeout(600)
            e = await pg.evaluate(ETAT)
            verifier(not e['son']['musique'] and e['gMus'] < 0.02, 'Ludi.reglerSon({musique:false}) coupe la musique en course', e)
            verifier(not erreurs, 'aucune erreur dans la page (' + '; '.join(erreurs) + ')')
            await c.close()

            # 5. Une vieille sauvegarde avec la musique et les bruitages à 0 ne rend pas le jeu muet
            vieille = json.dumps({'v': 1, 'nom': 'Lou', 'maitrise': {}, 'records': {}, 'recordsTables': {}, 'debloquees': ['paille'],
                                  'musique': 0, 'bruitages': 0, 'classe': '50', 'vuesDeblocage': []})
            c, pg, erreurs = await nouvelle_page(b, "if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('pluie-de-cochons.v1', %s); }" % json.dumps(vieille))
            await pg.goto(BASE + '/index.html')
            await pg.wait_for_timeout(1200)
            await toucher(pg, 360, 300)
            e = await attendre_musique(pg)
            sv = await pg.evaluate("window.__jeu.sv()")
            verifier(e['son'] == {'musique': True, 'bruitages': True, 'voix': True} and e['gMus'] > 0.1 and e['gSfx'] > 0.2
                     and sv['nom'] == 'Lou' and 'musique' not in sv and 'bruitages' not in sv,
                     'vieille sauvegarde musique 0 : le jeu n\'est pas muet, la partie est gardée, le son n\'y est plus', e)
            await c.close()

            # 6. Dans un launcher : le message « ludi:son » est suivi, le bouton du jeu prévient le launcher
            c, pg, erreurs = await nouvelle_page(b)
            await pg.set_viewport_size({'width': 390, 'height': 844})
            await pg.goto(BASE + '/lanceur.html')
            await pg.wait_for_timeout(1500)
            fr = pg.frames[1]
            verifier(await fr.evaluate("window.Ludi.inLauncher()"), 'le jeu se sait dans le launcher')
            await pg.evaluate("document.getElementById('jeu').contentWindow.postMessage({ type: 'ludi:son', son: { musique: false, bruitages: true, voix: false } }, location.origin)")
            await pg.wait_for_timeout(400)
            e = await fr.evaluate(ETAT)
            verifier(e['son'] == {'musique': False, 'bruitages': True, 'voix': False}, 'message ludi:son du launcher suivi', e)
            # le bouton musique du jeu (dans le cadre de 390 x 844) : le réglage de toute la maison
            await pg.mouse.click(*ecran_xy(pg, 20 + 32, logique_wh(pg)[1] - 84 + 32))
            await pg.wait_for_timeout(500)
            e = await fr.evaluate(ETAT)
            recus = await pg.evaluate("window.recus.filter(m => m.type === 'ludi:son')")
            verifier(e['son']['musique'] and recus and recus[-1]['son'] == {'musique': True, 'bruitages': True, 'voix': False},
                     'bouton musique dans le launcher : ludi:son envoyé à Ludiworld', {'etat': e, 'recus': recus})
            e = await attendre_musique(pg, fr)
            verifier(e['gMus'] > 0.1, 'la musique joue dans le launcher après le bouton', e)
            if OUT: await pg.screenshot(path=f'{OUT}/son-06-launcher.png')
            verifier(not erreurs, 'aucune erreur dans le launcher (' + '; '.join(erreurs) + ')')
            await c.close()
            await b.close()
    finally:
        srv.shutdown()
    print(f'OK : {len(ok)} vérifications')

if __name__ == '__main__':
    if OUT: os.makedirs(OUT, exist_ok=True)
    asyncio.run(main())
