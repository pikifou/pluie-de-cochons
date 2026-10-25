"""Captures du mode Astuces : python3 tests/captures_cartes.py [dossier]"""
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
    await shot('0titre')
    await pg.evaluate("window.__jeu.aller('astuces')"); await pg.wait_for_timeout(800); await shot('1choix')
    await pg.evaluate("window.__jeu.lancerCartes(7)"); await pg.wait_for_timeout(900); await shot('2astuce7')
    await pg.evaluate("(()=>{const F=window.__jeu.F; F.etape='devant'; F.cartes[0]={a:7,b:8}; F.t=0;})()")
    await pg.wait_for_timeout(1200); await shot('3devant')
    await pg.evaluate("window.__jeu.retourner()"); await pg.wait_for_timeout(900); await shot('4dos')
    await pg.evaluate("window.__jeu.repondreCarte(true)")
    await pg.evaluate("(()=>{const F=window.__jeu.F; F.cartes[1]={a:3,b:9};})()")
    await pg.wait_for_timeout(500); await pg.evaluate("window.__jeu.retourner()"); await pg.wait_for_timeout(900); await shot('5dos9')
    for _ in range(20):
        st = await pg.evaluate("window.__jeu.F.etape")
        if st == 'fin': break
        if st == 'devant': await pg.evaluate("window.__jeu.retourner()"); await pg.wait_for_timeout(450)
        await pg.evaluate("window.__jeu.repondreCarte(Math.random() < 0.8)"); await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(1500); await shot('6fin')
    print(nom, 'erreurs', err)
    await b.close()

async def main():
    async with async_playwright() as p:
        await scenario(p, 'paysage', 1280, 720)
        await scenario(p, 'portrait', 412, 915)
asyncio.run(main())
