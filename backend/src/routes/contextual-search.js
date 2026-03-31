'use strict'
// DATA: no direct DB access in this file - compatibility wrapper to canonical Supabase search routes

const { Router } = require('express')

const router = Router()

router.use(require('./search/contextual'))
router.use(require('./search/dex'))

module.exports = router
