'use strict'

;(() => {
  function hasText(value) {
    return String(value || '').trim().length > 0
  }

  function parseStructuredValue(value, fallback = null) {
    if (value == null || value === '') return fallback
    if (Array.isArray(value) || typeof value === 'object') return value
    if (typeof value !== 'string') return fallback

    try {
      return JSON.parse(value)
    } catch (_error) {
      return fallback
    }
  }

  function parseStructuredArray(value) {
    const parsed = parseStructuredValue(value, null)
    if (Array.isArray(parsed)) return parsed
    if (parsed == null || parsed === '') return []
    return [parsed]
  }

  function uniqueTruthy(values = []) {
    return [...new Set(values.filter(Boolean))]
  }

  function toArray(value) {
    return Array.isArray(value) ? value : []
  }

  function normalizeConfidenceBand(game = {}, richness = {}) {
    const sourceConfidence = Number(game.source_confidence ?? game.sourceConfidence ?? 0)

    if (sourceConfidence >= 80) {
      return { key: 'high', label: 'Confiance haute', shortLabel: 'Confiance haute' }
    }

    if (sourceConfidence >= 50 || (game?.curation?.isPublished && richness.score >= 5)) {
      return { key: 'medium', label: 'Confiance utile', shortLabel: 'Confiance utile' }
    }

    if (game?.curation?.isPublished) {
      return { key: 'medium', label: 'Surface publiee', shortLabel: 'Surface publiee' }
    }

    return { key: 'low', label: 'Lecture en consolidation', shortLabel: 'En consolidation' }
  }

  function buildRichness(game = {}, options = {}) {
    const detail = options.detail || {}
    const archive = options.archive || {}
    const encyclopedia = options.encyclopedia || {}
    const content = detail.content || {}
    const overview = content.overview || {}
    const mediaDocs = toArray(content.media_docs)
    const manuals = uniqueTruthy([
      archive.manual_url,
      game.manual_url,
      ...mediaDocs.filter((entry) => String(entry?.mediaType || '').toLowerCase() === 'manual').map((entry) => entry.url || entry.embed_url),
    ])
    const anecdoteCount = parseStructuredArray(encyclopedia.dev_anecdotes || archive.dev_anecdotes || game.dev_anecdotes).length
    const cheatCount = parseStructuredArray(encyclopedia.cheat_codes || archive.cheat_codes || game.cheat_codes).length
    const versionCount = parseStructuredArray(archive.versions || game.versions).length
    const ostTracks = parseStructuredArray(archive.ost?.notable_tracks || game.ost_notable_tracks)
    const teamEntries = toArray(encyclopedia.dev_team).length + parseStructuredArray(game.dev_team).length
    const hasSummary = hasText(game.summary) || hasText(game.synopsis) || hasText(overview.summary) || hasText(overview.synopsis)
    const hasTagline = hasText(game.tagline)
    const hasPrices = [game.loosePrice, game.cibPrice, game.mintPrice].some((value) => Number(value) > 0)
    const hasMetascore = Number(game.metascore) > 0
    const hasManuals = manuals.length > 0 || Boolean(game?.signals?.hasManuals)
    const hasMaps = Boolean(game?.signals?.hasMaps) || mediaDocs.some((entry) => String(entry?.mediaType || '').toLowerCase() === 'map')
    const hasSprites = Boolean(game?.signals?.hasSprites) || mediaDocs.some((entry) => ['sprite', 'sprites', 'sprite_sheet'].includes(String(entry?.mediaType || '').toLowerCase()))
    const hasEndings = Boolean(game?.signals?.hasEndings) || mediaDocs.some((entry) => String(entry?.mediaType || '').toLowerCase() === 'ending')
    const hasDuration = Number(archive.avg_duration_main || game.avg_duration_main) > 0 || Number(archive.avg_duration_complete || game.avg_duration_complete) > 0
    const hasRecords = hasText(archive.speedrun_wr || game.speedrun_wr) || toArray(content.competition).length > 0

    const features = [
      { key: 'summary', label: 'Resume', weight: 2, active: hasSummary },
      { key: 'tagline', label: 'Tagline', weight: 1, active: hasTagline },
      { key: 'crew', label: 'Crew', weight: 1, active: teamEntries > 0 || hasText(game.dev_team) || hasText(game.developer) },
      { key: 'price', label: 'Prix', weight: 1, active: hasPrices },
      { key: 'manual', label: 'Manual', weight: 1, active: hasManuals },
      { key: 'ost', label: 'OST', weight: 1, active: ostTracks.length > 0 },
      { key: 'anecdotes', label: 'Anecdotes', weight: 1, active: anecdoteCount > 0 },
      { key: 'cheats', label: 'Cheats', weight: 1, active: cheatCount > 0 },
      { key: 'versions', label: 'Versions', weight: 1, active: versionCount > 0 },
      { key: 'duration', label: 'Duree', weight: 1, active: hasDuration },
      { key: 'records', label: 'Records', weight: 1, active: hasRecords },
      { key: 'meta', label: 'Metascore', weight: 1, active: hasMetascore },
      { key: 'maps', label: 'Maps', weight: 1, active: hasMaps },
      { key: 'sprites', label: 'Sprites', weight: 1, active: hasSprites },
      { key: 'endings', label: 'Ending', weight: 1, active: hasEndings },
    ]

    const score = features.reduce((sum, feature) => sum + (feature.active ? feature.weight : 0), 0)
    let band = { key: 'light', label: 'Base stable', shortLabel: 'Base stable', note: 'Lecture propre, encore legere sur les couches riches.' }

    if (score >= 9) {
      band = { key: 'dense', label: 'Archive dense', shortLabel: 'Archive dense', note: 'Fiche riche : lecture, signaux et couches de contexte deja visibles.' }
    } else if (score >= 6) {
      band = { key: 'solid', label: 'Lecture solide', shortLabel: 'Lecture solide', note: 'Base de lecture forte, avec plusieurs couches utiles deja reliees.' }
    } else if (score >= 3) {
      band = { key: 'growing', label: 'Enrichissement actif', shortLabel: 'Enrichissement actif', note: 'Archive stable, encore en cours de densification sur les contenus premium.' }
    }

    const completionState = game?.curation?.isPublished
      ? { key: 'published', label: 'Surface publiee', shortLabel: 'Publiee' }
      : score >= 6
        ? { key: 'curated', label: 'Lecture structuree', shortLabel: 'Structuree' }
        : { key: 'in_progress', label: 'Enrichissement en cours', shortLabel: 'En cours' }

    const confidence = normalizeConfidenceBand(game, { score })
    const highlightLabels = features.filter((feature) => feature.active).slice(0, 4).map((feature) => feature.label)

    return {
      score,
      band,
      completionState,
      confidence,
      highlights: highlightLabels,
      counts: {
        anecdotes: anecdoteCount,
        cheats: cheatCount,
        versions: versionCount,
        manuals: manuals.length,
        ostTracks: ostTracks.length,
      },
    }
  }

  window.RetroDexContentSignals = {
    hasText,
    parseStructuredArray,
    buildRichness,
  }
})()
