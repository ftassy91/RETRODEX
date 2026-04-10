/* ============================================================
   baz-kb.js — Knowledge Base retrieval for BAZ
   Lexical matching against a local JSON KB.
   Loaded after baz-gen.js, before baz-engine.js
   ============================================================ */

;(function () {
  'use strict'

  var _entries = null
  var _loaded = false

  function normalize(text) {
    return String(text || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function scoreEntry(input, entry) {
    var normalizedInput = normalize(input)
    var score = 0
    var matched = 0

    for (var i = 0; i < entry.keywords.length; i++) {
      var kw = normalize(entry.keywords[i])
      if (normalizedInput.indexOf(kw) !== -1) {
        // Longer keyword matches score higher
        score += kw.length
        matched++
      }
    }

    // Bonus for multiple keyword matches
    if (matched > 1) score *= 1.5

    return score
  }

  function search(input) {
    if (!_entries || !_entries.length) return null

    var bestScore = 0
    var bestEntry = null

    for (var i = 0; i < _entries.length; i++) {
      var s = scoreEntry(input, _entries[i])
      if (s > bestScore) {
        bestScore = s
        bestEntry = _entries[i]
      }
    }

    // Minimum score threshold: at least 3 chars matched
    if (bestScore < 3) return null

    return {
      answer: bestEntry.answer,
      score: bestScore,
      keywords: bestEntry.keywords,
    }
  }

  function init(url) {
    url = url || '/assets/baz/baz-kb.json'

    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('KB fetch failed: ' + res.status)
        return res.json()
      })
      .then(function (data) {
        _entries = Array.isArray(data.entries) ? data.entries : []
        _loaded = true
        if (typeof console !== 'undefined') {
          console.log('[BAZ-KB] Loaded ' + _entries.length + ' entries.')
        }
        return true
      })
      .catch(function (err) {
        if (typeof console !== 'undefined') {
          console.warn('[BAZ-KB] Load failed:', err.message)
        }
        return false
      })
  }

  // Auto-init on load
  if (document.readyState === 'complete') {
    init()
  } else {
    window.addEventListener('load', function () {
      setTimeout(init, 2000)
    })
  }

  window.BAZKB = {
    search: search,
    init: init,
    get ready() { return _loaded },
  }
})()
