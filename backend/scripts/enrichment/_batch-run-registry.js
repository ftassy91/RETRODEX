'use strict'

const fs = require('fs')
const path = require('path')

const REGISTRY_DIR = path.join(__dirname, '..', '..', 'data', 'enrichment')
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'batch_runs.jsonl')

function ensureRegistryDir() {
  if (!fs.existsSync(REGISTRY_DIR)) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true })
  }
}

function sanitizeError(error) {
  if (!error) return null
  return {
    message: String(error.message || error),
    stack: error && error.stack ? String(error.stack) : null,
  }
}

function recordBatchEvent(event) {
  ensureRegistryDir()
  const payload = {
    recordedAt: new Date().toISOString(),
    ...event,
  }
  fs.appendFileSync(REGISTRY_FILE, `${JSON.stringify(payload)}\n`, 'utf8')
  return payload
}

module.exports = {
  REGISTRY_DIR,
  REGISTRY_FILE,
  recordBatchEvent,
  sanitizeError,
}
