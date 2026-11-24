const CACHE = 'furia-shell-v4';
const CDN_CACHE = 'furia-runtime-v2';
const BASE = new URL('./', self.location.href);
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest'].map(x => new URL(x, BASE).toString());
const RUNTIME_HOSTS = new Set(['esm.run', 'cdn.jsdelivr.net']);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(FILES);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (![CACHE, CDN_CACHE].includes(key)) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        return (await cache.match(new URL('./index.html', BASE).toString())) || Response.error();
      }
    })());
    return;
  }
  // Cache runtime bundles. Model weights are cached by the selected AI library itself.
  if (RUNTIME_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && response.type !== 'opaque') await cache.put(event.request, response.clone());
      return response;
    })());
  }
});
