// sw-rastro.js — cache-first para o Leaflet (CDN) e o app shell,
// pra o mapa funcionar mesmo sem internet depois da primeira visita.
// Os blocos (tiles) do mapa NÃO passam por aqui — o app cuida deles
// direto via IndexedDB (ver módulo "MAPA OFFLINE" no HTML).
var CACHE_NAME = 'rastro-shell-v2';
var PRECACHE_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return fetch(url, { mode: 'cors' }).then(function (resp) {
          if (resp && resp.ok) return cache.put(url, resp);
        }).catch(function () {
          // Sem internet agora — sem problema, cacheia na próxima vez que abrir online
        });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; })
        .map(function (n) { return caches.delete(n); }));
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = req.url;
  var ehLeaflet = url.indexOf('unpkg.com/leaflet') > -1;

  if (ehLeaflet) {
    // Cache-first: uma vez baixado, funciona sem internet dali em diante
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (resp) {
          if (resp && resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    // Network-first pro próprio HTML, com fallback pro cache se cair a internet
    event.respondWith(
      fetch(req).then(function (resp) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, clone); });
        return resp;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // Demais requisições (tiles de mapa, etc.) seguem direto pra rede —
  // o app já trata o cache de tiles por conta própria.
});
