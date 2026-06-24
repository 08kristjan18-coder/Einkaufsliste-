const CACHE = 'einkaufsliste-v4';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(ASSETS.map(a => c.add(a).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('overpass') || url.includes('nominatim') || url.includes('tile.openstreetmap')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
    return;
  }
  // Fonts: Cache-first, dann Netz
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
      ).catch(() => new Response('', {status: 503}))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).catch(() => new Response('Offline', {status: 503}))
    )
  );
});
