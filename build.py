#!/usr/bin/env python3
"""Construit Pluie de Cochons.

python3 build.py            -> index.html autonome (tout intégré, pour l'artefact)
python3 build.py --pwa docs -> appli installable dans docs/ (GitHub Pages)
"""
import base64, json, os, sys, shutil, hashlib

ICI = os.path.dirname(os.path.abspath(__file__))
def lire(p): return open(os.path.join(ICI, p), encoding='utf-8').read()
def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(os.path.join(ICI, p), 'rb').read()).decode())

def assets(musique_en_fichiers):
    a = {'img': {}, 'voix': {}, 'music': {}}
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/img'))):
        a['img'][f[:-4]] = b64('assets/img/' + f, 'image/png')
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/voix'))):
        a['voix'][f[:-4]] = b64('assets/voix/' + f, 'audio/mpeg')
    for f in sorted(os.listdir(os.path.join(ICI, 'assets/music'))):
        a['music'][f[:-4]] = ('music/' + f) if musique_en_fichiers else b64('assets/music/' + f, 'audio/mpeg')
    return a

def page(pwa):
    h = lire('src/index.html')
    h = h.replace('/*FONT_PS2*/', b64('assets/fonts/pressstart.woff2', 'font/woff2'))
    h = h.replace('/*FONT_PDC*/', b64('assets/fonts/pixelify-700.woff2', 'font/woff2'))
    h = h.replace('/*ASSETS*/', json.dumps(assets(pwa)))
    for cle, f in [('LOGIC', 'logic'), ('AUDIO', 'audio'), ('GFX', 'gfx'), ('GAME', 'game')]:
        h = h.replace('/*%s*/' % cle, lire('src/%s.js' % f))
    if pwa:
        h = h.replace('<!--PWA-->', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-180.png">')
        h = h.replace('<!--SW-->', "<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');</script>")
    else:
        h = h.replace('<!--PWA-->', '').replace('<!--SW-->', '')
    return h

def icones(dossier):
    from PIL import Image, ImageDraw
    hero = Image.open(os.path.join(ICI, 'assets/img/heros.png')).convert('RGBA')
    for taille in (180, 192, 512):
        im = Image.new('RGBA', (taille, taille), (7, 10, 36, 255))
        d = ImageDraw.Draw(im)
        e = taille // 24
        d.rectangle([e, e, taille - e - 1, taille - e - 1], outline=(77, 243, 255, 255), width=max(3, taille // 64))
        s = int(taille * 0.72)
        h = hero.resize((s, s), Image.NEAREST)
        im.alpha_composite(h, ((taille - s) // 2, (taille - s) // 2 + taille // 40))
        im.save(os.path.join(dossier, 'icon-%d.png' % taille))

def main():
    if '--pwa' in sys.argv:
        dossier = os.path.join(ICI, sys.argv[sys.argv.index('--pwa') + 1])
        os.makedirs(os.path.join(dossier, 'music'), exist_ok=True)
        html = page(True)
        open(os.path.join(dossier, 'index.html'), 'w', encoding='utf-8').write(html)
        for f in os.listdir(os.path.join(ICI, 'assets/music')):
            shutil.copy(os.path.join(ICI, 'assets/music', f), os.path.join(dossier, 'music', f))
        icones(dossier)
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
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
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
