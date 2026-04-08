'use strict'
// DATA: no direct DB access in this file - delegates to Supabase-only collection routes

const { Router } = require('express')

const router = Router()

router.use(require('./crud'))
router.use(require('./stats'))
router.use(require('./cockpit'))

module.exports = router
