'use strict'

const API_KEY = process.env.RETRODEX_API_KEY

if (!API_KEY) {
  console.warn(
    '[auth] WARNING: RETRODEX_API_KEY is not set. '
    + 'All protected routes will return 500 until it is configured.'
  )
}

/**
 * Express middleware that requires a valid API key in the `x-api-key` header.
 *
 * - 500 if RETRODEX_API_KEY env var is missing
 * - 401 if header is absent
 * - 403 if header value does not match
 */
function requireApiKey(req, res, next) {
  const configured = process.env.RETRODEX_API_KEY

  if (!configured) {
    return res.status(500).json({
      ok: false,
      error: 'API key not configured',
    })
  }

  const provided = req.headers['x-api-key']

  if (!provided) {
    return res.status(401).json({
      ok: false,
      error: 'Missing x-api-key header',
    })
  }

  if (provided !== configured) {
    return res.status(403).json({
      ok: false,
      error: 'Forbidden',
    })
  }

  return next()
}

module.exports = { requireApiKey }
