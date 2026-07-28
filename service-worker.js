// German Vocabulary in Context — B1 · Service Worker
// v1 · Seite wird zuerst aus dem Netz geholt, Rest aus dem Cache.
// Offline funktioniert weiterhin alles.

const CACHE = 'gvic-b1-v1';

const ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

// Wie lange auf das Netz gewartet wird, bevor der Cache einspringt
const NETWORK_TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Netz mit Zeitlimit: kommt nach 3 Sekunden nichts, wird der Cache benutzt
function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT);
    fetch(request).then(
      resp => { clearTimeout(timer); resolve(resp); },
      err  => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isPage =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  // --- Die Seite selbst: erst Netz, damit Updates sofort ankommen ---
  if (isPage) {
    e.respondWith(
      fetchWithTimeout(e.request)
        .then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // --- Alles andere: erst Cache, dann Netz ---
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(resp => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
