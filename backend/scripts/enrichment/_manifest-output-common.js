'use strict'

const fs = require('fs')
const path = require('path')

const GENERATED_MANIFEST_DIR = path.join(__dirname, 'manifests', 'generated')

function ensureGeneratedManifestDir() {
  if (!fs.existsSync(GENERATED_MANIFEST_DIR)) {
    fs.mkdirSync(GENERATED_MANIFEST_DIR, { recursive: true })
  }
}

function writeGeneratedManifest(batchKey, manifest) {
  ensureGeneratedManifestDir()
  const manifestPath = path.join(GENERATED_MANIFEST_DIR, `${batchKey}.json`)
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  return manifestPath
}

module.exports = {
  GENERATED_MANIFEST_DIR,
  ensureGeneratedManifestDir,
  writeGeneratedManifest,
}
