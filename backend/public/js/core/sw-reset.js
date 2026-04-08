'use strict'

;(() => {
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    return
  }

  let cleanupStarted = false

  async function clearRetroDexCaches() {
    try {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => /trodex/i.test(String(key)))
          .map((key) => caches.delete(key))
      )
    } catch (_error) {}
  }

  async function unregisterRetroDexWorkers() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch (_error) {}
  }

  function runCleanup() {
    if (cleanupStarted) {
      return
    }

    cleanupStarted = true
    clearRetroDexCaches()
    unregisterRetroDexWorkers()
  }

  runCleanup()
  window.addEventListener('load', runCleanup, { once: true })
})()
