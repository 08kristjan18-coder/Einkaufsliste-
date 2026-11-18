const CACHE = 'liste-v12';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const cp = res.clone();
    caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
  }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Karten/Läden-Suche: immer direkt ins Netz
  if (/overpass|nominatim|openstreetmap/.test(url.hostname)) return;

  // Seite: erst Netz (damit Updates ankommen), bei Funkloch aus dem Cache
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 4000);
        const res = await fetch(req.url, { signal: ac.signal, cache: 'no-cache' });
        clearTimeout(t);
        if (res.ok) put('./index.html', res);
        return res;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Schriften + eigene Dateien: sofort aus dem Cache, im Hintergrund aktualisieren
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => put(req, res)).catch(() => cached || new Response('', { status: 503 }));
        return cached || net;
      })
    );
  }
});
