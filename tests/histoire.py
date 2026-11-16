"""Parcours de l'histoire : python tests/histoire.py <dossier_captures> [url_pwa]

Fichier unique (index.html, sans vidéo) : intro au premier choix d'un mode, fin forcée à la Coupe Étoile,
marque « Fini » sur l'écran titre. Si url_pwa est donnée (docs/ servi en http), vérifie aussi que les vidéos jouent.
Lance Chromium installé par Playwright (python tout court).
"""
import sys, os, asyncio, pathlib
from playwright.async_api import async_playwright

ICI = pathlib.Path(__file__).resolve().parent.parent
OUT = sys.argv[1] if len(sys.argv) > 1 else 'captures-histoire'
PWA = sys.argv[2] if len(sys.argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
erreurs = []

FORCER_FIN = """(() => {
  const J = window.__jeu, sv = J.sv();
  for (const id of ['paille', 'boue', 'gland', 'tracteur']) sv.records[id + ':50'] = { temps: 1, place: 1 };
  J.lancerCourse({ mode: 'coupe', coupe: 'etoile', classe: '50' });
  J.R.course.temps = 9.5; J.R.course.justes = 3; J.R.course.finie = true;
  J.finCourse();
})()"""

async def cliquer_mode(pg, i):
    # bouton de mode i (0 apprendre, 1 entraînement, 2 défi) de l'écran titre, en portrait
    vw, vh = pg.viewport_size['width'], pg.viewport_size['height']
    W = 720; H = 720 * vh / vw; bh, gap = 104, 20
    y0 = H - 110 - 3 * bh - 2 * gap
    y = (y0 + i * (bh + gap) + bh / 2) * vw / W
    await pg.mouse.click(vw / 2, y)

async def page(b, vw, vh, url):
    pg = await b.new_page(viewport={'width': vw, 'height': vh})
    pg.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: erreurs.append(str(e)))
    await pg.goto(url)
    await pg.wait_for_timeout(1500)
    return pg

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        fichier = (ICI / 'index.html').as_uri()

        # téléphone, fichier unique
        pg = await page(b, 390, 844, fichier)
        await pg.screenshot(path=f'{OUT}/01-titre-avant.png')
        await cliquer_mode(pg, 2)
        await pg.wait_for_timeout(1200)
        assert await pg.evaluate("window.__jeu.cineOuverte") == 'intro', 'intro absente'
        await pg.screenshot(path=f'{OUT}/02-intro-telephone.png')
        await pg.click('#cine .go')
        await pg.wait_for_timeout(600)
        assert await pg.evaluate("window.__jeu.ecran") == 'coupes'
        await pg.screenshot(path=f'{OUT}/03-coupes.png')
        # la deuxième fois, pas d'intro
        await pg.evaluate("window.__jeu.aller('titre')")
        await pg.wait_for_timeout(300)
        await cliquer_mode(pg, 1)
        await pg.wait_for_timeout(500)
        assert not await pg.evaluate("window.__jeu.cineOuverte"), 'intro rejouée'
        assert await pg.evaluate("window.__jeu.ecran") == 'tables'
        # la fin
        await pg.evaluate(FORCER_FIN)
        await pg.wait_for_timeout(1500)
        assert await pg.evaluate("window.__jeu.cineOuverte") == 'fin', 'fin absente'
        await pg.screenshot(path=f'{OUT}/04-fin-telephone.png')
        await pg.click('#cine .go')
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{OUT}/05-podium-apres-fin.png')
        etat = await pg.evaluate("JSON.parse(localStorage.getItem('ludi.v1.pluie-de-cochons') || '{}').etat")
        print('kit, état :', etat)
        assert etat and etat['fini'], 'Ludi.fini() pas appelé'
        # une deuxième victoire à la Coupe Étoile : pas de nouvelle fin
        await pg.evaluate(FORCER_FIN)
        await pg.wait_for_timeout(800)
        assert not await pg.evaluate("window.__jeu.cineOuverte"), 'fin rejouée'
        await pg.evaluate("window.__jeu.aller('titre')")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/06-titre-fini-telephone.png')
        # rechargement : la marque reste
        await pg.reload(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f'{OUT}/07-titre-fini-recharge.png')
        await pg.close()

        # tablette en paysage
        pg = await page(b, 1180, 820, fichier)
        await pg.evaluate("window.__jeu.cinematique('intro')")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/08-intro-tablette.png')
        await pg.click('#cine .go')
        await pg.evaluate(FORCER_FIN)
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/09-fin-tablette.png')
        await pg.click('#cine .go')
        await pg.evaluate("window.__jeu.aller('titre')")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=f'{OUT}/10-titre-fini-tablette.png')
        await pg.close()

        # version installée : les vidéos
        if PWA:
            pg = await page(b, 390, 844, PWA)
            await pg.evaluate("window.__jeu.cinematique('intro')")
            await pg.wait_for_timeout(2500)
            t = await pg.evaluate("document.querySelector('#cine video').currentTime")
            print('intro, vidéo à', t, 's')
            assert t > 0.5, 'la vidéo d\'intro ne joue pas'
            await pg.screenshot(path=f'{OUT}/11-intro-video.png')
            await pg.click('#cine .passer')
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'{OUT}/12-intro-passer.png')
            await pg.click('#cine .go')
            await pg.evaluate(FORCER_FIN)
            await pg.wait_for_timeout(3000)
            t = await pg.evaluate("document.querySelector('#cine video').currentTime")
            print('fin, vidéo à', t, 's')
            assert t > 0.5, 'la vidéo de fin ne joue pas'
            await pg.screenshot(path=f'{OUT}/13-fin-video.png')
            await pg.wait_for_timeout(9000)
            assert 'texte' in await pg.evaluate("document.getElementById('cine').className"), 'pas de texte après la vidéo'
            await pg.screenshot(path=f'{OUT}/14-fin-apres-video.png')
            await pg.close()

        await b.close()
    print('erreurs :', erreurs or 'aucune')
    assert not erreurs

asyncio.run(main())
