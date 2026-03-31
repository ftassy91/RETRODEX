'use strict'
// DATA: legacy Sequelize path - not mounted by default in the canonical Supabase runtime

// LEGACY: this wrapper mounts the old Sequelize-backed games routes, but the
// canonical public runtime no longer mounts it by default. Keep for migration
// review only; new runtime work belongs to the Supabase readers used by
// `serverless.js`.
const { Router } = require('express')
const router = Router()

router.use(require('./games-admin'))
router.use(require('./games-list'))
router.use(require('./games-detail'))

module.exports = router
