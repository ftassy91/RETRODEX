'use strict'

const fs = require('fs')

function readJsonOrJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.items)) return parsed.items
    return [parsed]
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function normalizeComposer(entry) {
  if (!entry) return null
  if (typeof entry === 'string') {
    const name = String(entry).trim()
    return name ? { name, role: 'composer' } : null
  }

  const name = String(entry.name || entry.artistName || entry.creditName || '').trim()
  if (!name) return null

  return {
    name,
    role: 'composer',
    sortName: String(entry.sortName || '').trim() || null,
    musicbrainzArtistId: String(entry.musicbrainzArtistId || entry.artistId || entry.id || '').trim() || null,
    disambiguation: String(entry.disambiguation || '').trim() || null,
  }
}

function normalizeTrack(entry) {
  if (!entry) return null
  if (typeof entry === 'string') {
    const title = String(entry).trim()
    return title ? { title } : null
  }

  const title = String(entry.title || entry.trackTitle || '').trim()
  if (!title) return null

  return {
    title,
    position: Number.isFinite(Number(entry.position)) ? Number(entry.position) : null,
    lengthMs: Number.isFinite(Number(entry.lengthMs || entry.length_ms)) ? Number(entry.lengthMs || entry.length_ms) : null,
    musicbrainzRecordingId: String(entry.musicbrainzRecordingId || entry.recordingId || '').trim() || null,
  }
}

function inferSourceUrl(entry) {
  if (String(entry.sourceUrl || '').trim()) {
    return String(entry.sourceUrl).trim()
  }
  const releaseId = String(entry.musicbrainzReleaseId || entry.releaseId || '').trim()
  if (releaseId) {
    return `https://musicbrainz.org/release/${releaseId}`
  }
  const releaseGroupId = String(entry.musicbrainzReleaseGroupId || entry.releaseGroupId || '').trim()
  if (releaseGroupId) {
    return `https://musicbrainz.org/release-group/${releaseGroupId}`
  }
  return ''
}

function normalizeDatasetEntry(entry) {
  const gameId = String(entry.gameId || entry.entityId || entry.id || '').trim()
  if (!gameId) return null

  const composers = (Array.isArray(entry.composers) ? entry.composers : [])
    .map(normalizeComposer)
    .filter(Boolean)

  const tracks = (Array.isArray(entry.tracks) ? entry.tracks : [])
    .map(normalizeTrack)
    .filter(Boolean)

  return {
    gameId,
    releaseTitle: String(entry.releaseTitle || entry.title || '').trim() || null,
    releaseDate: String(entry.releaseDate || '').trim() || null,
    label: String(entry.label || '').trim() || null,
    musicbrainzReleaseId: String(entry.musicbrainzReleaseId || entry.releaseId || '').trim() || null,
    musicbrainzReleaseGroupId: String(entry.musicbrainzReleaseGroupId || entry.releaseGroupId || '').trim() || null,
    composers,
    tracks,
    sourceUrl: inferSourceUrl(entry),
  }
}

function loadMusicbrainzDataset(filePath) {
  const rows = readJsonOrJsonl(filePath)
  const map = new Map()
  for (const row of rows) {
    const normalized = normalizeDatasetEntry(row)
    if (!normalized) continue
    map.set(normalized.gameId, normalized)
  }
  return map
}

module.exports = {
  loadMusicbrainzDataset,
}
