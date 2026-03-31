'use strict'

const { Router } = require('express')

const router = Router()

router.use(require('./crud'))
router.use(require('./stats'))

module.exports = router
