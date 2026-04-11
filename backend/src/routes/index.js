'use strict'
// DATA: no direct DB access in this file - delegates to Supabase-only route modules

const { Router } = require('express')

const router = Router()

router.use(require('./games/index'))
router.use(require('./search/index'))
router.use(require('./collection/index'))
router.use(require('./market/index'))
router.use(require('./franchises/index'))
router.use(require('./prices/index'))
router.use(require('./baz'))
router.use(require('./cron'))

module.exports = router
