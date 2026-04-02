#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const tempDbPath = path.join(os.tmpdir(), `retrodex-runtime-check-${Date.now()}.sqlite`)
process.env.DB_PATH = tempDbPath
process.env.RETRODEX_SQLITE_PATH = tempDbPath
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const Database = require('better-sqlite3')
const { bootstrapLocalSandbox } = require('../src/runtime/local-bootstrap')
const { startServer } = require('../src/server')
const { getLegacyRuntime } = require('../src/runtime/legacy-runtime')

function captureSchemaSnapshot(filePath) {
  const sqlite = new Database(filePath, { readonly: true })
  try {
    return sqlite.prepare(`
      SELECT type, name, tbl_name AS tableName, sql
      FROM sqlite_master
      WHERE type IN ('table', 'index')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `).all()
  } finally {
    sqlite.close()
  }
}

async function main() {
  await bootstrapLocalSandbox()
  const before = captureSchemaSnapshot(tempDbPath)
  const server = await startServer(3199)

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })

  const after = captureSchemaSnapshot(tempDbPath)
  const beforeJson = JSON.stringify(before)
  const afterJson = JSON.stringify(after)

  console.log(JSON.stringify({
    ok: beforeJson === afterJson,
    beforeCount: before.length,
    afterCount: after.length,
  }, null, 2))

  if (beforeJson !== afterJson) {
    process.exitCode = 1
  }
}

main().catch(async (error) => {
  console.error('[verify-runtime-nonmutating] Failed:', error)
  process.exitCode = 1
}).finally(async () => {
  const { sequelize } = getLegacyRuntime()
  await sequelize.close().catch(() => {})
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath)
  }
})
