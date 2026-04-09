#!/usr/bin/env node
'use strict'

const { parseArgs } = require('../_supabase-publish-common')
const { runMarketPipeline } = require('./run-market-pipeline')

runMarketPipeline({
  ...parseArgs(process.argv.slice(2)),
  connector: 'mercari_us',
})
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error('[fetch-mercari-us]', error.message)
    process.exitCode = 1
  })
