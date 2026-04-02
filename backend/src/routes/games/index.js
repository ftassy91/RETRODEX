'use strict'
// DATA: no direct DB access in this file - delegates to Supabase-only game routes

const { Router } = require('express')

const router = Router()

router.use(require('./list'))
router.use(require('./archive'))
router.use(require('./encyclopedia'))
router.use(require('./detail'))

module.exports = router
