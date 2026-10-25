"""Mesure des images par seconde sur un téléphone simulé (CPU ralenti) : python3 tests/perf.py [fichier.html] [variante]"""
import sys, os, asyncio, json
from playwright.async_api import async_playwright

ICI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = sys.argv[1] if len(sys.argv) > 1 else ICI + '/index.html'
VARIANTE = sys.argv[2] if len(sys.argv) > 2 else ''

MESURE = """(ms) => new Promise(ok => {
  const t = []; let d = performance.now(), fin = d + ms;
  function f(n) { t.push(n - d); d = n; if (n < fin) requestAnimationFrame(f); else {
    t.sort((a, b) => a - b);
    const moy = t.reduce((s, x) => s + x, 0) / t.length;
    ok({ fps: Math.round(1000 / moy), moyenne: +moy.toFixed(1), p95: +t[Math.floor(t.length * 0.95)].toFixed(1), images: t.length });
  } }
  requestAnimationFrame(f);
})"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
        ctxb = await b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
        pg = await ctxb.new_page()
        cdp = await ctxb.new_cdp_session(pg)
        await pg.goto('file://' + PAGE)
        await pg.wait_for_timeout(1500)
        if VARIANTE == 'sansombre':
            await pg.evaluate("(()=>{const c=document.getElementById('jeu').getContext('2d'); Object.defineProperty(c,'shadowBlur',{set(){},get(){return 0}});})()")
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 6})
        res = {}
        res['titre'] = await pg.evaluate(MESURE, 3000)
        await pg.evaluate("window.__jeu.lancerCourse({mode:'entrainement', table:9})")
        await pg.wait_for_timeout(2500)
        res['question'] = await pg.evaluate(MESURE, 2500)
        await pg.evaluate("(()=>{const R=window.__jeu.R; R.q={a:9,b:10}; R.course.file[0]={a:9,b:10};})()")
        for ch in '90': await pg.evaluate(f"window.__jeu.touche('{ch}')")
        await pg.evaluate("window.__jeu.touche('ok')")
        res['pluie_90_cochons'] = await pg.evaluate(MESURE, 3500)
        print(json.dumps(res, ensure_ascii=False))
        await b.close()

asyncio.run(main())
