'use strict'
// DATA: Sequelize via ../../database and ../../models - not part of the canonical public runtime
// ROLE: shared legacy hydrated game read facade for audit, console, and curation workflows
// CONSUMERS: audit-service, console-service, and curation-service
// STATUS: retained non-canonical shared read facade; implementation lives under ./game-read

module.exports = require('./game-read')
