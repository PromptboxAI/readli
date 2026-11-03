/*
 * Readli Kids offline support. Keeps the Readli Kids pages a device has opened, and the app's own
 * files, so a downloaded story can be opened and played without a connection (in the car, on a plane).
 * Pages always come from the network first; the copy here is used only when there is no connection.
 * Story audio isn't handled here: the player keeps downloads in its own cache and plays them itself.
 */
const PAGES = "readli-kids-pages-v1";
const FILES = "readli-kids-files-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, FILES];
      for (const name of await caches.keys()) {
        if (name.startsWith("readli-kids-") && !keep.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

/** From the network, keeping a copy; the copy only when the network can't be reached. */
async function networkFirst(request, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) await cache.put(key, response.clone());
    return response;
  } catch (err) {
    const kept = (await cache.match(key)) || (cacheName === PAGES ? await cache.match("/kids") : undefined);
    if (kept) return kept;
    throw err;
  }
}

/** Build files never change under the same name, so a kept copy is always right. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && (url.pathname === "/kids" || url.pathname.startsWith("/kids/"))) {
    event.respondWith(networkFirst(request, PAGES, url.pathname));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, FILES));
    return;
  }
  if (url.pathname.startsWith("/covers/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/_next/image")) {
    event.respondWith(networkFirst(request, FILES, request));
  }
});
