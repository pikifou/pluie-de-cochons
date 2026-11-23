"""Apprendre, puis s'entraîner, avant la course : python tests/conseils.py [dossier_captures]

Sert docs/ en http (port 7384), ouvre le jeu dans Chromium (Playwright, muet, voix du navigateur remplacée)
et touche les vrais boutons dessinés. Vérifie :
- une course lancée sans avoir rien appris ni entraîné demande « Tu es sûr ? » et propose d'apprendre la table ;
- le bouton « écouter » lit le conseil ; « Apprendre » ouvre les cartes de cette table ;
- un paquet de cartes fini est compté, et Apprendre le montre ;
- l'entraînement d'une table jamais apprise conseille d'aller apprendre ; « quand même » lance l'entraînement ;
- appris sans entraînement : la course conseille de s'entraîner ; « courir quand même » lance la course,
  et on ne le redemande plus pour cette coupe pendant la partie ;
- les boutons du conseil tiennent dans l'écran, en portrait et en paysage ; aucune erreur dans la page.
"""
import sys, json, asyncio, pathlib, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.async_api import async_playwright

try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
ICI = pathlib.Path(__file__).resolve().parent.parent
OUT = sys.argv[1] if len(sys.argv) > 1 else None
PORT = 7384
BASE = f'http://localhost:{PORT}'

class Servir(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

MUET = """(() => {
  window.__dits = [];
  try { speechSynthesis.speak = u => window.__dits.push(u.text); speechSynthesis.cancel = () => {}; } catch (e) {}
})();"""

ok = []
def verifier(cond, msg, etat=None):
    if not cond:
        raise AssertionError(msg + ('\n  ' + json.dumps(etat, ensure_ascii=False) if etat is not None else ''))
    ok.append(msg); print('ok :', msg)

def k_ecran(pg):
    return min(pg.viewport_size['width'], pg.viewport_size['height']) / 720

async def boutons(pg):
    return {b['id']: b for b in await pg.evaluate("window.__jeu.boutons()")}

async def toucher(pg, ident):
    bs = await boutons(pg)
    assert ident in bs, f'bouton {ident} absent : {sorted(bs)}'
    b, k = bs[ident], k_ecran(pg)
    await pg.mouse.click((b['x'] + b['w'] / 2) * k, (b['y'] + b['h'] / 2) * k)
    await pg.wait_for_timeout(450)

async def conseil(pg):
    return await pg.evaluate("(() => { const k = window.__jeu.conseil; return k && { aller: k.c.aller, table: k.c.table, appris: k.c.appris, entraine: k.c.entraine, mode: k.o.mode }; })()")

async def tient_dans_l_ecran(pg, nom):
    bs = await boutons(pg)
    vw, vh = pg.viewport_size['width'], pg.viewport_size['height']
    W, H = vw / k_ecran(pg), vh / k_ecran(pg)
    ids = [i for i in bs if i.startswith('conseil-')]
    dedans = all(bs[i]['x'] >= 0 and bs[i]['y'] >= 0 and bs[i]['x'] + bs[i]['w'] <= W + 0.5 and bs[i]['y'] + bs[i]['h'] <= H + 0.5 for i in ids)
    a, p = bs.get('conseil-aller'), bs.get('conseil-passer')
    separes = a and p and a['y'] + a['h'] <= p['y']
    verifier(dedans and separes, f'{nom} : les boutons du conseil tiennent dans l\'écran sans se chevaucher', {'W': W, 'H': H, 'boutons': {i: bs[i] for i in ids}})

async def depart(pg, coupe):
    await pg.evaluate(f"window.__jeu.choixCoupe = '{coupe}'; window.__jeu.aller('depart')")
    await pg.wait_for_timeout(600)

async def main():
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Servir, directory=str(ICI / 'docs')))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--mute-audio'])
            c = await b.new_context(viewport={'width': 390, 'height': 844})
            await c.add_init_script(MUET)
            pg = await c.new_page()
            erreurs = []
            pg.on('pageerror', lambda e: erreurs.append(str(e)))
            pg.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' else None)
            await pg.goto(BASE + '/index.html')
            await pg.wait_for_timeout(1200)

            # 1. Rien appris, rien entraîné : la course demande « Tu es sûr ? » et propose d'apprendre
            await depart(pg, 'boue')
            await toucher(pg, 'partez')
            k = await conseil(pg)
            ecran = await pg.evaluate("window.__jeu.ecran")
            verifier(k == {'aller': 'apprendre', 'table': 3, 'appris': False, 'entraine': False, 'mode': 'coupe'} and ecran == 'depart',
                     'course sans rien avoir fait : la course ne part pas, conseil d\'apprendre la table de 3', k)
            await tient_dans_l_ecran(pg, 'portrait')
            if OUT: await pg.screenshot(path=f'{OUT}/conseil-01-tu-es-sur.png')
            await toucher(pg, 'conseil-ecouter')
            dits = await pg.evaluate("window.__dits")
            verifier(len(dits) == 1 and 'vraiment faire la course' in dits[0] and 'table de 3' in dits[0], 'le bouton écouter lit le conseil', dits)
            await toucher(pg, 'conseil-aller')
            e = await pg.evaluate("({ ecran: window.__jeu.ecran, table: window.__jeu.F && window.__jeu.F.table, conseil: !!window.__jeu.conseil })")
            verifier(e == {'ecran': 'cartes', 'table': 3, 'conseil': False}, '« Apprendre » ouvre les cartes de la table de 3', e)

            # 2. Un paquet de cartes fini est compté, et Apprendre le montre
            await pg.evaluate("""(() => { const j = window.__jeu; let n = 0;
              while (j.F.etape !== 'fin' && n++ < 100) { if (j.F.etape === 'astuce') { j.F.etape = 'devant'; } j.retourner(); j.repondreCarte(true); } })()""")
            appris = await pg.evaluate("window.__jeu.sv().appris")
            verifier(appris == {'3': 1}, 'cartes de la table de 3 finies : comptées une fois', appris)
            await pg.evaluate("window.__jeu.lancerCartes(3)")
            await pg.evaluate("""(() => { const j = window.__jeu; let n = 0;
              while (j.F.etape !== 'fin' && n++ < 100) { if (j.F.etape === 'astuce') { j.F.etape = 'devant'; } j.retourner(); j.repondreCarte(n % 3 > 0); } })()""")
            appris = await pg.evaluate("window.__jeu.sv().appris")
            verifier(appris == {'3': 2}, 'un deuxième paquet, même avec des erreurs : compté deux fois', appris)
            await pg.evaluate("window.__jeu.aller('astuces')")
            await pg.wait_for_timeout(700)
            if OUT: await pg.screenshot(path=f'{OUT}/conseil-02-apprendre-marques.png')

            # 3. Entraînement d'une table jamais apprise : conseil d'apprendre, « quand même » lance l'entraînement
            await pg.evaluate("window.__jeu.aller('tables')")
            await pg.wait_for_timeout(600)
            await toucher(pg, 't7')
            k = await conseil(pg)
            verifier(k == {'aller': 'apprendre', 'table': 7, 'appris': False, 'entraine': False, 'mode': 'entrainement'}, 'entraînement de la table de 7 jamais apprise : conseil d\'aller apprendre', k)
            if OUT: await pg.screenshot(path=f'{OUT}/conseil-03-entrainement.png')
            verifier(sorted(await boutons(pg)) == ['conseil-aller', 'conseil-ecouter', 'conseil-passer'], 'pendant le conseil, seuls ses boutons répondent')
            await toucher(pg, 'conseil-passer')
            e = await pg.evaluate("({ ecran: window.__jeu.ecran, mode: window.__jeu.R && window.__jeu.R.mode, table: window.__jeu.R && window.__jeu.R.table })")
            verifier(e == {'ecran': 'course', 'mode': 'entrainement', 'table': 7}, '« Y aller quand même » lance l\'entraînement de la table de 7', e)

            # 4. Table apprise : l'entraînement part sans conseil
            await pg.evaluate("window.__jeu.aller('tables')")
            await pg.wait_for_timeout(600)
            await toucher(pg, 't3')
            e = await pg.evaluate("({ ecran: window.__jeu.ecran, conseil: !!window.__jeu.conseil, table: window.__jeu.R.table })")
            verifier(e == {'ecran': 'course', 'conseil': False, 'table': 3}, 'table de 3 apprise : l\'entraînement part tout de suite', e)

            # 5. Appris sans entraînement : la course conseille de s'entraîner ; « courir quand même » ; plus redemandé
            await pg.evaluate("(() => { const s = window.__jeu.sv(); s.appris = { 3: 2, 4: 1, 5: 1 }; s.recordsTables = { 3: { temps: 40, historique: [40], fois: 1 }, 5: { temps: 30, historique: [30], fois: 1 } }; })()")
            await depart(pg, 'boue')
            await toucher(pg, 'partez')
            k = await conseil(pg)
            verifier(k == {'aller': 'entrainement', 'table': 4, 'appris': True, 'entraine': False, 'mode': 'coupe'}, 'appris sans entraînement : conseil de s\'entraîner à la table de 4', k)
            if OUT: await pg.screenshot(path=f'{OUT}/conseil-04-entraine-toi.png')
            await toucher(pg, 'conseil-passer')
            e = await pg.evaluate("({ ecran: window.__jeu.ecran, mode: window.__jeu.R.mode, coupe: window.__jeu.R.coupe })")
            verifier(e == {'ecran': 'course', 'mode': 'coupe', 'coupe': 'boue'}, '« Courir quand même » lance la course', e)
            await depart(pg, 'boue')
            await toucher(pg, 'partez')
            e = await pg.evaluate("({ ecran: window.__jeu.ecran, conseil: !!window.__jeu.conseil })")
            verifier(e == {'ecran': 'course', 'conseil': False}, 'la même coupe relancée : on ne redemande pas pendant la partie', e)

            # 6. Paysage : le conseil tient dans l'écran
            await pg.set_viewport_size({'width': 844, 'height': 390})
            await pg.wait_for_timeout(400)
            await depart(pg, 'gland')
            await toucher(pg, 'partez')
            verifier((await conseil(pg) or {}).get('table') == 6, 'paysage : conseil pour la Coupe Gland, table de 6')
            await tient_dans_l_ecran(pg, 'paysage')
            if OUT: await pg.screenshot(path=f'{OUT}/conseil-05-paysage.png')
            await pg.set_viewport_size({'width': 1280, 'height': 720})
            await pg.wait_for_timeout(400)
            await tient_dans_l_ecran(pg, 'ordinateur')
            if OUT: await pg.screenshot(path=f'{OUT}/conseil-06-ordinateur.png')

            verifier(not erreurs, 'aucune erreur dans la page (' + '; '.join(erreurs) + ')')
            await c.close()
            await b.close()
    finally:
        srv.shutdown()
    print(f'{len(ok)} vérifications, toutes OK')

asyncio.run(main())
