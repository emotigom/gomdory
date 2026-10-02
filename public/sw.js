const STATIC_CACHE = "gom-static-v3";
const OFFLINE_URL = "/offline";
const SHORT_HOSTS = new Set(["gkrry.com", "www.gkrry.com", "g.gkrry.com", "www.g.gkrry.com"]);
const isShortHost = SHORT_HOSTS.has(self.location.hostname);

if (isShortHost) {
  self.addEventListener("install", () => {
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener("fetch", (event) => {
    event.respondWith(fetch(event.request));
  });
} else {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/favicon.svg"]))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.mode === "navigate") {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
      return;
    }

    if (url.searchParams.has("_rsc")) {
      event.respondWith(fetch(request));
      return;
    }

    if (
      url.pathname.startsWith("/_next/static") ||
      url.pathname.startsWith("/icons") ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/favicon.svg"
    ) {
      event.respondWith(
        caches.open(STATIC_CACHE).then((cache) =>
          cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            });
          }),
        ),
      );
    }
  });
}
