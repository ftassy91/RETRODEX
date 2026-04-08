"use strict";

const CACHE_MATCH = /trodex/i;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => CACHE_MATCH.test(String(key)))
        .map((key) => caches.delete(key)),
    );
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
