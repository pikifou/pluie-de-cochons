"""Captures d'écran automatiques : python3 tests/captures.py [dossier]"""
import sys, os, asyncio
from playwright.async_api import async_playwright

ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/captures'
os.makedirs(OUT, exist_ok=True)

async def scenario(p, nom, vw, vh):
    b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args=['--autoplay-policy=no-user-gesture-required'])
    pg = await b.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=1)
    erreurs = []
    pg.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: erreurs.append(str(e)))
    await pg.goto('file://' + ICI + '/index.html')
    await pg.wait_for_timeout(1200)
    async def shot(n): await pg.screenshot(path=f'{OUT}/{nom}_{n}.png')
    async def attendre_question():
        for _ in range(40):
            st = await pg.evaluate("(()=>{const R=window.__jeu.R; return R ? [R.q.a,R.q.b,R.phase] : null})()")
            if st and st[2] == 'question': return st
            await pg.wait_for_timeout(200)
        return st
    await shot('1titre')
    await pg.evaluate("window.__jeu.aller('coupes')")
    await pg.wait_for_timeout(700); await shot('2coupes')
    await pg.evaluate("window.__jeu.choixCoupe='boue'; window.__jeu.sv().classe='100'; window.__jeu.aller('depart')")
    await pg.wait_for_timeout(900); await shot('3depart')
    await pg.evaluate("window.__jeu.lancerCourse({mode:'coupe', coupe:'boue', classe:'100'})")
    await pg.wait_for_timeout(1000); await shot('4decompte')
    await pg.wait_for_timeout(2600)
    q = await attendre_question()
    print(nom, 'question', q)
    a, bb = q[0], q[1]
    for ch in str(a * bb): await pg.evaluate(f"window.__jeu.touche('{ch}')")
    await pg.wait_for_timeout(1500); await shot('5question')
    await pg.evaluate("window.__jeu.touche('ok')")
    await pg.wait_for_timeout(500); await shot('6pluie')
    await pg.wait_for_timeout(1500); await shot('7juste')
    await pg.wait_for_timeout(2500)
    # mauvaise réponse : il manque
    q = await attendre_question()
    print(nom, 'question2', q)
    rep = max(1, q[0] * q[1] - q[0] - 1)
    for ch in str(rep): await pg.evaluate(f"window.__jeu.touche('{ch}')")
    await pg.evaluate("window.__jeu.touche('ok')")
    await pg.wait_for_timeout(2200); await shot('8manque')
    await pg.wait_for_timeout(2000); await shot('9correction')
    await pg.wait_for_timeout(2600)
    # déborde
    q = await attendre_question()
    print(nom, 'question3', q)
    rep = q[0] * q[1] + q[0] + 2
    for ch in str(rep): await pg.evaluate(f"window.__jeu.touche('{ch}')")
    await pg.evaluate("window.__jeu.touche('ok')")
    await pg.wait_for_timeout(2300); await shot('10deborde')
    await pg.wait_for_timeout(3500)
    # finir juste
    for _ in range(14):
        if await pg.evaluate("window.__jeu.ecran") != 'course': break
        st = await attendre_question()
        if not st or st[2] != 'question': continue
        for ch in str(st[0] * st[1]): await pg.evaluate(f"window.__jeu.touche('{ch}')")
        await pg.evaluate("window.__jeu.touche('ok')")
        await pg.wait_for_timeout(2500)
    await pg.wait_for_timeout(3500); await shot('11resultats')
    print(nom, 'écran', await pg.evaluate("window.__jeu.ecran"))
    await pg.evaluate("window.__jeu.aller('tables')")
    await pg.wait_for_timeout(1200); await shot('12tables')
    # grande grange 9x8 en entraînement
    await pg.evaluate("window.__jeu.lancerCourse({mode:'entrainement', table:9})")
    await pg.wait_for_timeout(800)
    await pg.evaluate("(()=>{const R=window.__jeu.R; R.q={a:9,b:8}; R.course.file[0]={a:9,b:8};})()")
    for ch in '72': await pg.evaluate(f"window.__jeu.touche('{ch}')")
    await pg.evaluate("window.__jeu.touche('ok')")
    await pg.wait_for_timeout(3600); await shot('13grande')
    print(nom, 'erreurs', erreurs[:8])
    await b.close()

async def main():
    async with async_playwright() as p:
        await scenario(p, 'paysage', 1280, 720)
        await scenario(p, 'portrait', 412, 915)

asyncio.run(main())
