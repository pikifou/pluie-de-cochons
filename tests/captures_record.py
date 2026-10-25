"""Deux entraînements de la table de 6 (lent puis rapide) pour voir le record : python3 tests/captures_record.py [dossier]"""
import sys, os, asyncio
from playwright.async_api import async_playwright
ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/captures'
os.makedirs(OUT, exist_ok=True)

async def scenario(p, nom, vw, vh):
    b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
    pg = await b.new_page(viewport={'width': vw, 'height': vh})
    err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    await pg.goto('file://' + ICI + '/index.html'); await pg.wait_for_timeout(1000)
    async def shot(n): await pg.screenshot(path=f'{OUT}/{nom}_{n}.png')
    async def partie(attente, erreur, prefixe):
        await pg.evaluate("window.__jeu.lancerCourse({mode:'entrainement', table:6})")
        faite = False
        for k in range(30):
            if await pg.evaluate("window.__jeu.ecran") != 'course': break
            st = None
            for _ in range(60):
                st = await pg.evaluate("(()=>{const R=window.__jeu.R; return R ? [R.q.a,R.q.b,R.phase] : null})()")
                if not st or st[2] == 'question': break
                await pg.wait_for_timeout(100)
            if not st or st[2] != 'question': continue
            await pg.wait_for_timeout(attente)
            if k == 3 and prefixe: await shot(prefixe + '_hud')
            rep = st[0] * st[1] + (1 if erreur and not faite else 0)
            faite = True
            for ch in str(rep): await pg.evaluate(f"window.__jeu.touche('{ch}')")
            await pg.evaluate("window.__jeu.touche('ok')")
        await pg.wait_for_timeout(2600)
    await partie(1500, True, '')
    await shot('1premier')
    await partie(300, False, '2')
    await shot('3record')
    await pg.evaluate("window.__jeu.aller('tables')"); await pg.wait_for_timeout(1200); await shot('4tables')
    print(nom, 'erreurs', err, await pg.evaluate("JSON.stringify(window.__jeu.sv().recordsTables)"))
    await b.close()

async def main():
    async with async_playwright() as p:
        await scenario(p, 'paysage', 1280, 720)
        await scenario(p, 'portrait', 412, 915)
asyncio.run(main())
