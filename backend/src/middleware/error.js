'use strict'

function errorHandler(error, req, res, _next) {
  console.error(`RetroDex backend request failed: ${req.method} ${req.originalUrl}`, error)

  if (res.headersSent) {
    return
  }

  res.status(500).json({
    ok: false,
    error: 'Internal server error',
  })
}

module.exports = {
  errorHandler,
}
