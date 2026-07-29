// Offline shell only. The push handler lands with the reminders work.
const CACHE = "bloom-shell-v1";
const SHELL = ["/", "/static/css/app.css", "/static/js/htmx.min.js", "/static/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first, falling back to the cached shell. Never cache POSTs — an
// identification is a fresh call every time.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
