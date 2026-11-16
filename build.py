#!/usr/bin/env python3
"""Construit Pluie de Cochons.

python3 build.py            -> index.html autonome (tout intégré, pour l'artefact)
python3 build.py --pwa docs -> appli installable dans docs/ (GitHub Pages), avec la fiche Ludiworld ludi.json

src/ludi.js est le kit Ludiworld, copié tel quel depuis https://pikifou.github.io/ludiworld/kit/ludi.js
(intégré à la page pour marcher hors ligne).
"""
import base64, json, os, sys, shutil, hashlib

ICI = os.path.dirname(os.path.abspath(__file__))
def lire(p): return open(os.path.join(ICI, p), encoding='utf-8').read()
def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(os.path.join(ICI, p), 'rb').read()).decode())

def assets(musique_en_fichiers):
    a = {'img': {}, 'voix': {}, 'music': {}, 'histoire': {}}
    # les images de l'histoire (intro et fin), intégrées pour marcher hors ligne et en fichier unique
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/histoire'))):
        a['histoire'][f.rsplit('.', 1)[0]] = b64('assets/histoire/' + f, 'image/webp')
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/img'))):
        a['img'][f[:-4]] = b64('assets/img/' + f, 'image/png')
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/voix'))):
        a['voix'][f[:-4]] = b64('assets/voix/' + f, 'audio/mpeg')
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/music'))):
        a['music'][f[:-4]] = ('music/' + f) if musique_en_fichiers else b64('assets/music/' + f, 'audio/mpeg')
    return a

CINE = ['intro', 'fin']

def page(pwa):
    h = lire('src/index.html')
    h = h.replace('/*FONT_PS2*/', b64('assets/fonts/pressstart.woff2', 'font/woff2'))
    h = h.replace('/*FONT_PDC*/', b64('assets/fonts/pixelify-700.woff2', 'font/woff2'))
    h = h.replace('/*ASSETS*/', json.dumps(assets(pwa)))
    # les petites vidéos de l'histoire : seulement dans la version installée (le fichier unique montre directement l'image)
    h = h.replace('/*CINE*/', json.dumps({n: 'cine/%s.mp4' % n for n in CINE} if pwa else {}))
    for cle, f in [('LUDI', 'ludi'), ('LOGIC', 'logic'), ('AUDIO', 'audio'), ('GFX', 'gfx'), ('GAME', 'game')]:
        h = h.replace('/*%s*/' % cle, lire('src/%s.js' % f))
    if pwa:
        h = h.replace('<!--PWA-->', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-180.png">')
        h = h.replace('<!--SW-->', "<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');</script>")
    else:
        h = h.replace('<!--PWA-->', '').replace('<!--SW-->', '')
    return h

def icones(dossier):
    """Icônes de l'appli : le héros en gros pixels sur un horizon néon, pleine page, sans cadre
    (elles restent belles quand le téléphone ou Ludiworld arrondissent les coins)."""
    from PIL import Image, ImageDraw, ImageFilter
    hero = Image.open(os.path.join(ICI, 'assets/img/heros.png')).convert('RGBA')

    def lerp(a, b, k): return tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3))

    def petit_cochon(d, x, y, s):
        motif = ['.XX..XX.', 'XXXXXXXX', 'XOXXXXOX', 'XXXXXXXX', 'XXNNNNXX', 'XXNFFNXX', 'XXXXXXXX', '.XX..XX.']
        couleurs = {'X': (255, 150, 190), 'O': (20, 10, 40), 'N': (255, 110, 160), 'F': (120, 30, 70)}
        for j, ligne in enumerate(motif):
            for i, ch in enumerate(ligne):
                if ch != '.': d.rectangle([x + i * s, y + j * s, x + i * s + s - 1, y + j * s + s - 1], fill=couleurs[ch])

    for n in (180, 192, 512):
        im = Image.new('RGB', (n, n))
        d = ImageDraw.Draw(im)
        hz = int(n * 0.70)  # ligne d'horizon
        for y in range(n):
            if y < hz:
                k = y / hz
                c = lerp((6, 8, 34), (40, 12, 78), min(1, k * 1.25)) if k < .8 else lerp((40, 12, 78), (255, 79, 163), (k - .8) / .2 * .55)
            else:
                c = lerp((40, 10, 70), (8, 6, 30), (y - hz) / (n - hz))
            d.line([(0, y), (n, y)], fill=c)
        sol = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        ds = ImageDraw.Draw(sol)
        for i in range(1, 9):
            y = hz + (n - hz) * (i / 8) ** 1.8
            ds.line([(0, y), (n, y)], fill=(77, 243, 255, 150), width=max(1, n // 256))
        for i in range(-9, 10):
            ds.line([(n / 2 + i * n * 0.05, hz), (n / 2 + i * n * 0.32, n)], fill=(77, 243, 255, 130), width=max(1, n // 256))
        im.paste(sol, (0, 0), sol)
        d.line([(0, hz), (n, hz)], fill=(255, 140, 200), width=max(2, n // 128))
        halo = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse([n * .14, n * .16, n * .86, n * .88], fill=(255, 79, 163, 120))
        halo = halo.filter(ImageFilter.GaussianBlur(n // 14))
        im.paste(halo, (0, 0), halo)
        for fx, fy, div in ((.07, .10, 128), (.80, .05, 128), (.84, .40, 170), (.05, .46, 170)):
            petit_cochon(d, int(n * fx), int(n * fy), max(2, n // div))
        t = int(n * 0.74)
        h = hero.resize((t, t), Image.NEAREST)
        im.paste(h, ((n - t) // 2, int(n * 0.92) - t), h)
        im.save(os.path.join(dossier, 'icon-%d.png' % n))

def main():
    if '--pwa' in sys.argv:
        dossier = os.path.join(ICI, sys.argv[sys.argv.index('--pwa') + 1])
        os.makedirs(os.path.join(dossier, 'music'), exist_ok=True)
        html = page(True)
        open(os.path.join(dossier, 'index.html'), 'w', encoding='utf-8').write(html)
        for f in os.listdir(os.path.join(ICI, 'assets/music')):
            shutil.copy(os.path.join(ICI, 'assets/music', f), os.path.join(dossier, 'music', f))
        icones(dossier)
        os.makedirs(os.path.join(dossier, 'cine'), exist_ok=True)
        for n in CINE: shutil.copy(os.path.join(ICI, 'assets/cine', n + '.mp4'), os.path.join(dossier, 'cine'))
        # fiche Ludiworld, à la racine du site publié (pas dans le cache du service worker : toujours fraîche)
        shutil.copy(os.path.join(ICI, 'ludi.json'), os.path.join(dossier, 'ludi.json'))
        manifest = {
            'id': './', 'name': 'Pluie de Cochons', 'short_name': 'Cochons', 'lang': 'fr', 'orientation': 'any',
            'description': 'Les tables de multiplication avec des cochons qui tombent du ciel.',
            'start_url': './', 'scope': './', 'display': 'fullscreen',
            'background_color': '#070a24', 'theme_color': '#070a24',
            'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                      {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}],
        }
        open(os.path.join(dossier, 'manifest.webmanifest'), 'w').write(json.dumps(manifest, ensure_ascii=False, indent=1))
        version = hashlib.sha1(html.encode()).hexdigest()[:10]
        fichiers = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'] + ['music/' + f for f in sorted(os.listdir(os.path.join(ICI, 'assets/music')))]
        sw = """const V = 'pdc-%s';
const F = %s;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(F)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (new URL(e.request.url).pathname.includes('/cine/')) return; e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
""" % (version, json.dumps(fichiers))
        open(os.path.join(dossier, 'sw.js'), 'w').write(sw)
        print('PWA ->', dossier, 'version', version, '%.0f ko' % (len(html) / 1024))
    else:
        html = page(False)
        open(os.path.join(ICI, 'index.html'), 'w', encoding='utf-8').write(html)
        # version artefact : sans squelette (claude.ai l'ajoute), titre en tête
        import re
        corps = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
        style = re.search(r'<style>.*?</style>', html, re.S).group(0)
        style = style.replace('html, body {', 'html, body { height: 100%;')
        art = '<title>Pluie de Cochons</title>\n<meta name="theme-color" content="#070a24">\n' + style + corps
        open(os.path.join(ICI, 'artifact.html'), 'w', encoding='utf-8').write(art)
        print('index.html', '%.0f ko' % (len(html) / 1024))

main()
