// Bazaar service worker.
//
// Shell is cache-first so the installed app opens instantly and offline.
// data.json is deliberately NOT served from cache by the page (it fetches
// network-first); we only keep a copy here so an offline open still shows
// the last scan that reached the device.
const SHELL = "bazaar-shell-v3";
const DATA = "bazaar-data-v1";
const SHELL_FILES = ["./", "index.html", "manifest.webmanifest",
                     "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // Listing photos: cache-first, they never change once written.
  if (url.pathname.includes("/img/")) {
    e.respondWith(caches.open(DATA).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // data.json: keep the newest successful copy for offline opens.
  if (url.pathname.endsWith("data.json")) {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res.ok) (await caches.open(DATA)).put("data.json", res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match("data.json");
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
