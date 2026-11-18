/* ORBEO · service worker: abre sin conexión y recibe versiones nuevas.
   No toca las llamadas a Google (script, mapas) ni al cambio de moneda: esas las guarda la app. */
const VERSION = 'orbeo-1.0.0';
const ARCHIVOS = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest',
  'fonts/inter-latin.woff2', 'fonts/inter-latin-ext.woff2',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png',
  'img/demo/viajera.jpg', 'img/demo/kioto.jpg', 'img/demo/inari.jpg', 'img/demo/templo.jpg', 'img/demo/nishiki.jpg',
  'img/demo/gion.jpg', 'img/demo/ryokan.jpg', 'img/demo/lisboa.jpg', 'img/demo/islandia.jpg', 'img/demo/nyc.jpg'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION)
  .then(c => Promise.all(ARCHIVOS.map(a => fetch(a, { cache: 'no-cache' }).then(r => r.ok ? c.put(a, r) : null).catch(() => null))))
  .then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.indexOf('orbeo-') === 0 && k !== VERSION).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || e.request.headers.has('range')) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' })
    .then(r => { if (r.ok && r.status === 200) { const c = r.clone(); caches.open(VERSION).then(k => k.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })
      .then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))
      .then(r => r || new Response('', { status: 504 }))));
});
