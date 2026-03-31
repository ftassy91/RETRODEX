'use strict'
// DATA: no direct DB access in this file - delegates to mixed canonical and legacy-isolated market routes

const { Router } = require('express')

const router = Router()

router.use(require('./items'))
router.use(require('./catalog'))
router.use(require('./stats'))

module.exports = router
