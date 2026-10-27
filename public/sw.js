const BASE_PATH = '/cineflow';
const CACHE_NAME = 'cineflow-shell-v2';
const PRECACHE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/player/`,
  `${BASE_PATH}/library/`,
  `${BASE_PATH}/playlists/`,
  `${BASE_PATH}/settings/`,
  `${BASE_PATH}/privacy/`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/pwa-192x192.png`,
  `${BASE_PATH}/pwa-512x512.png`,
  `${BASE_PATH}/maskable-512x512.png`,
  `${BASE_PATH}/apple-touch-icon.png`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/brand/cineflow-logo.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept blob:, data:, chrome-extension:, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.protocol.startsWith('blob') ||
    url.protocol.startsWith('data')
  ) {
    return;
  }

  // Handle navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match(`${BASE_PATH}/offline.html`);
          return fallback || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
    );
    return;
  }

  // Handle other assets (CSS, JS, images, icons)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached, and update in background if online
        fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkRes);
            });
          }
        }).catch(() => {/* ignore background fetch errors */});
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      });
    })
  );
});
