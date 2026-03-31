'use strict'
// DATA: no direct DB access in this file - compatibility wrapper to canonical Supabase route tree

const { Router } = require('express')

const router = Router()

router.use(require('./games/index'))
router.use(require('./search/global'))
router.use(require('./collection/index'))
router.use(require('./market/index'))
router.use(require('./franchises/index'))

module.exports = router
