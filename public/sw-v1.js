
const CACHE_NAME = 'psalms-hymns-v13';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lyrics_1_100.json',
  '/lyrics_101_200.json',
  '/lyrics_201_300.json',
  '/lyrics_301_400.json',
  '/lyrics_401_end.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first for navigation requests to ensure updates are seen
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }

      // Define caching strategy for external resources (CDNs)
      const url = new URL(event.request.url);
      const isExternalCdn = url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'aistudiocdn.com';

      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || (response.type !== 'basic' && !isExternalCdn && response.type !== 'cors')) {
          return response;
        }

        // If it's one of our external CDNs or an internal asset, cache it
        if (isExternalCdn || event.request.url.startsWith(self.location.origin)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }

        return response;
      });
    })
  );
});

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
