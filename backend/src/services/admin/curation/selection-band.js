'use strict'

const fs = require('fs')

function uniqueStrings(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ))
}

function normalizeBandItems(payload) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => ({ entityId: String(entry.entityId || entry.gameId || entry.id || '').trim(), ...entry }))
      .filter((entry) => entry.entityId)
  }

  const candidates = []
  if (Array.isArray(payload?.catalog)) candidates.push(...payload.catalog)
  if (Array.isArray(payload?.items)) candidates.push(...payload.items)
  if (Array.isArray(payload?.buffer)) candidates.push(...payload.buffer)

  return candidates
    .map((entry) => ({ entityId: String(entry.entityId || entry.gameId || entry.id || '').trim(), ...entry }))
    .filter((entry) => entry.entityId)
}

function loadSelectionBand(selectionBandPath) {
  if (!selectionBandPath) {
    return null
  }

  const raw = JSON.parse(fs.readFileSync(selectionBandPath, 'utf8'))
  const items = normalizeBandItems(raw)
  const explicitIds = uniqueStrings(raw?.ids)
  const ids = explicitIds.length ? explicitIds : uniqueStrings(items.map((entry) => entry.entityId))

  return {
    path: selectionBandPath,
    label: String(raw?.label || raw?.selection?.tier || '').trim() || null,
    generatedAt: raw?.generatedAt || null,
    ids,
    items,
    raw,
  }
}

module.exports = {
  loadSelectionBand,
}
