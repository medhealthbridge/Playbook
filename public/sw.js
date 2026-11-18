// Playbook service worker: keeps the 3D story's files on the device so repeat visits load
// instantly, even on a slow connection. It caches ONLY static files:
//   /_next/static/*  build files (names are content-hashed, so cache-first is always right)
//   /assets/*        textures, photos, HDRIs (served from cache at once, refreshed in the background)
// Pages, API calls, logins and payments never touch this cache.
const CACHE = "pb-static-v1";
// Build files get new names on every deploy, so old ones would pile up on a regular visitor's
// phone. Keep at most this many entries; the oldest go first (cache keys keep insertion order).
const MAX_ENTRIES = 250;

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(k);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pb-static-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return; // videos stream with range requests: leave to the browser
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const hashed = url.pathname.startsWith("/_next/static/");
  const asset = url.pathname.startsWith("/assets/");
  if (!hashed && !asset) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") event.waitUntil(cache.put(req, res.clone()).then(() => trim(cache)));
          return res;
        })
        .catch(() => undefined);
      if (hit) {
        if (asset) event.waitUntil(refresh); // file names are not hashed: pick up replacements next time
        return hit;
      }
      const res = await refresh;
      return res || Response.error();
    }),
  );
});
