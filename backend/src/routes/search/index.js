'use strict'
// DATA: no direct DB access in this file - delegates to Supabase-only search routes

const { Router } = require('express')

const router = Router()

router.use(require('./global'))
router.use(require('./dex'))
router.use(require('./contextual'))

module.exports = router
