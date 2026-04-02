'use strict'
// DATA: Sequelize via admin/audit modules - not part of the canonical public runtime
// ROLE: audit, divergence, and priority reports for manual back-office review
// CONSUMERS: backend/src/routes/admin/audit.js, backend/scripts/run-audit.js
// STATUS: retained admin facade; split into admin/audit/*

module.exports = require('./audit')
