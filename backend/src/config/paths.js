'use strict'

const path = require('path')

const configuredPath = process.env.DB_PATH || process.env.RETRODEX_SQLITE_PATH

const DB_PATH = configuredPath
  ? (path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(__dirname, '../../..', configuredPath))
  : path.join(__dirname, '../../storage/retrodex.sqlite')

module.exports = { DB_PATH }
