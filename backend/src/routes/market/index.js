'use strict'

const { Router } = require('express')

const router = Router()

router.use(require('./items'))
router.use(require('./catalog'))
router.use(require('./stats'))

module.exports = router
