const CACHE_NAME = "chajabot-pwa-v9";
const APP_SHELL = [
  "/",
  "/index.html",
  "/admin.html",
  "/app.js",
  "/admin.js",
  "/styles.css",
  "/public/manifest.webmanifest",
  "/public/js/chajabot-engine.js",
  "/public/data/welfare-resources.json",
  "/public/data/resource-stats.json",
  "/public/data/image-prompt-templates.json",
  "/public/assets/logo.png",
  "/public/assets/state-idle.png",
  "/public/assets/state-curious.png",
  "/public/assets/state-listening.png",
  "/public/assets/chajabot-full.png",
  "/public/assets/sticker-example-input.png",
  "/public/assets/sticker-example-result.png",
  "/public/icons/favicon-32.png",
  "/public/icons/apple-touch-icon.png",
  "/public/icons/icon-192.png",
  "/public/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
