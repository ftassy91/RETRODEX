#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')
const srcRoot = path.join(repoRoot, 'backend', 'src')
const scopePaths = [
  path.join(srcRoot, 'server.js'),
  path.join(srcRoot, 'routes'),
  path.join(srcRoot, 'services'),
  path.join(srcRoot, 'helpers'),
]

const blockedSegments = [
  `${path.sep}backend${path.sep}scripts${path.sep}`,
  `${path.sep}polish-retrodex${path.sep}`,
  `${path.sep}frontend${path.sep}`,
  `${path.sep}_quarantine${path.sep}`,
  `${path.sep}_pending_review${path.sep}`,
  `${path.sep}docs${path.sep}_superseded${path.sep}`,
]

function shouldCheckFile(filePath) {
  const normalized = filePath.toLowerCase()
  if (!normalized.endsWith('.js')) {
    return false
  }

  if (normalized.includes(`${path.sep}routes${path.sep}admin${path.sep}`)) {
    return false
  }

  if (normalized.includes(`${path.sep}services${path.sep}admin${path.sep}`)) {
    return false
  }

  if (normalized.includes(`${path.sep}services${path.sep}public-`)
    || normalized.includes(`${path.sep}services${path.sep}public-runtime-payload${path.sep}`)
    || normalized.includes(`${path.sep}routes${path.sep}`)
    || normalized.endsWith(`${path.sep}server.js`)
    || normalized.includes(`${path.sep}helpers${path.sep}`)) {
    return true
  }

  return false
}

function walkFiles(targetPath) {
  const stat = fs.statSync(targetPath)
  if (stat.isFile()) {
    return [targetPath]
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true })
  return entries.flatMap((entry) => walkFiles(path.join(targetPath, entry.name)))
}

function resolveImport(currentFile, importPath) {
  if (!importPath.startsWith('.')) {
    return null
  }

  const basePath = path.resolve(path.dirname(currentFile), importPath)
  const candidates = [
    basePath,
    `${basePath}.js`,
    path.join(basePath, 'index.js'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.normalize(candidate)
    }
  }

  return path.normalize(basePath)
}

function collectViolations(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const violations = []
  const regex = /require\((['"])([^'"]+)\1\)|import\s+.+?\s+from\s+(['"])([^'"]+)\3/g

  for (const match of content.matchAll(regex)) {
    const importPath = match[2] || match[4]
    const resolved = resolveImport(filePath, importPath)
    if (!resolved) {
      continue
    }

    const normalized = path.normalize(resolved)
    const blocked = blockedSegments.find((segment) => normalized.includes(segment))
    if (blocked) {
      violations.push({
        file: path.relative(repoRoot, filePath),
        importPath,
        resolved: path.relative(repoRoot, normalized),
        rule: blocked.replaceAll(path.sep, '/'),
      })
    }
  }

  return violations
}

function main() {
  const files = scopePaths
    .flatMap((target) => walkFiles(target))
    .filter(shouldCheckFile)

  const violations = files.flatMap((filePath) => collectViolations(filePath))
  console.log(JSON.stringify({
    ok: violations.length === 0,
    checkedFiles: files.length,
    violations,
  }, null, 2))

  if (violations.length > 0) {
    process.exitCode = 1
  }
}

main()
