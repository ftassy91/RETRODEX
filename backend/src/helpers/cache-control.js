'use strict'

function buildEdgeCacheValue(maxAge, staleWhileRevalidate) {
  const parts = ['public', `max-age=${Math.max(0, Number(maxAge) || 0)}`]
  const swr = Math.max(0, Number(staleWhileRevalidate) || 0)
  if (swr > 0) {
    parts.push(`stale-while-revalidate=${swr}`)
  }
  return parts.join(', ')
}

function setPublicEdgeCache(
  res,
  {
    browserMaxAge = 0,
    cdnMaxAge = 0,
    staleWhileRevalidate = 0,
    vercelMaxAge = cdnMaxAge,
    vercelStaleWhileRevalidate = staleWhileRevalidate,
  } = {}
) {
  if (!res || typeof res.set !== 'function') {
    return
  }

  res.set('Cache-Control', `public, max-age=${Math.max(0, Number(browserMaxAge) || 0)}, must-revalidate`)
  res.set('CDN-Cache-Control', buildEdgeCacheValue(cdnMaxAge, staleWhileRevalidate))
  res.set('Vercel-CDN-Cache-Control', buildEdgeCacheValue(vercelMaxAge, vercelStaleWhileRevalidate))
}

module.exports = {
  setPublicEdgeCache,
}
