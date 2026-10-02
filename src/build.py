# Assemble le site : index.html (application complète, un seul fichier) + sw.js à la racine du dépôt.
import os, hashlib
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..')
rd = lambda *p: open(os.path.join(here, *p), encoding='utf-8').read()
plan = rd('plan.json').strip()
app = rd('partA.html') + rd('partB2.js') + '\n' + rd('partOld2.js') + '\n' + rd('partV2.js') + '\n' + rd('partX.js') + '\n' + rd('partW.js') + '\n' + rd('partC2.js')
app = app.replace('/*PLAN_JSON*/null', plan)
head = '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Carnet d'entraînement trail : programme de 25 semaines, séances GPX, repas, progression.">
<meta name="theme-color" content="#FFF1F7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E0A17" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="NTMF 42">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html,body{margin:0}body{font:14px/1.4 system-ui,-apple-system,sans-serif;background:#FFF1F7}img{max-width:100%}[hidden]{display:none!important}</style>
<script>
''' + rd('web', 'claude-shim.js') + '''
</script>
</head>
<body>
'''
tail = '''
<script>if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });</script>
</body>
</html>
'''
html = head + app + tail
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(html)
build = hashlib.sha1(html.encode()).hexdigest()[:10]
open(os.path.join(root, 'sw.js'), 'w', encoding='utf-8').write(rd('web', 'sw.js').replace('__BUILD__', build))
print('OK -> index.html, sw.js (version ' + build + ')')
