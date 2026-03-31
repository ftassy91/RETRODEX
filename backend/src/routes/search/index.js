'use strict'

const { Router } = require('express')

const router = Router()

router.use(require('./global'))
router.use(require('./dex'))
router.use(require('./contextual'))

module.exports = router
