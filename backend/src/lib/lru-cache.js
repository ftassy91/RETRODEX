'use strict';

class LRUCache {
  constructor(maxSize = 200, ttlMs = 300000) { // default 200 entries, 5 min TTL
    this.maxSize = maxSize
    this.ttlMs = ttlMs
    this.cache = new Map()
  }

  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }
    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key, value) {
    this.cache.delete(key) // remove if exists to refresh position
    if (this.cache.size >= this.maxSize) {
      // Delete oldest (first entry in Map)
      const oldest = this.cache.keys().next().value
      this.cache.delete(oldest)
    }
    this.cache.set(key, { value, ts: Date.now() })
  }

  clear() {
    this.cache.clear()
  }

  get size() {
    return this.cache.size
  }
}

module.exports = { LRUCache }
