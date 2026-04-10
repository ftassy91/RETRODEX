/* ============================================================
   erudit-engine.js — L'Erudit: collection page character
   Replaces BAZ on collection.html with a mysterious, judgmental presence.
   Uses the same codec infrastructure via window.BAZ.setCharacter()
   ============================================================ */

;(function () {
  'use strict'

  // Only activate on collection page
  if (!location.pathname.includes('collection')) return

  var _corpus = null
  var _loaded = false
  var _lastReplies = {}

  function loadCorpus() {
    if (_corpus) return Promise.resolve(_corpus)
    return fetch('/assets/erudit/erudit-corpus.json')
      .then(function (r) { return r.ok ? r.json() : {} })
      .then(function (data) { _corpus = data; _loaded = true; return data })
      .catch(function () { _corpus = {}; return {} })
  }

  function pickReply(category) {
    if (!_corpus || !_corpus[category]) return '...'
    var pool = _corpus[category]
    if (pool.length <= 1) return pool[0] || '...'
    var last = _lastReplies[category]
    var pick, tries = 0
    do {
      pick = pool[Math.floor(Math.random() * pool.length)]
      tries++
    } while (pick === last && tries < 5)
    _lastReplies[category] = pick
    return pick
  }

  // Intent parser for collection context
  var KEYWORDS = {
    signal_fix: ['corriger', 'doublon', 'fix', 'erreur', 'probleme'],
    signal_qualify: ['qualifier', 'qualification', 'completude', 'region', 'incomplet'],
    signal_sell: ['vendre', 'vente', 'sell', 'plus-value', 'benefice'],
    signal_upgrade: ['upgrade', 'upgrader', 'ameliorer', 'cib', 'loose vers'],
    signal_opportunity: ['acheter', 'achat', 'saisir', 'opportunite', 'wishlist'],
    signal_stale: ['stagnant', 'stale', 'dormant', 'wishlist vieille'],
    help: ['aide', 'help', '/help', 'quoi', 'comment'],
    lore: ['qui', 'nom', 'appelle', 'origine', 'd\'ou', 'viens', 'baz', 'petit', 'autre', '...'],
    about_baz: ['baz', 'le petit', 'le guide', 'l\'autre'],
    game_comment: [],  // matched by game title detection
  }

  var _loreUsed = {}

  function parseIntent(text) {
    var lower = (text || '').toLowerCase().trim()
    if (!lower) return 'unknown'

    // Lore first (special handling)
    for (var i = 0; i < KEYWORDS.lore.length; i++) {
      if (lower.indexOf(KEYWORDS.lore[i]) !== -1) return 'lore'
    }

    for (var intent in KEYWORDS) {
      if (intent === 'lore' || intent === 'game_comment') continue
      var kws = KEYWORDS[intent]
      for (var k = 0; k < kws.length; k++) {
        if (lower.indexOf(kws[k]) !== -1) return intent
      }
    }

    return 'unknown'
  }

  function ask(text) {
    return loadCorpus().then(function () {
      var intent = parseIntent(text)

      // Lore: each fragment only once per session
      if (intent === 'lore') {
        var lorePool = (_corpus.lore || []).filter(function (r) { return !_loreUsed[r] })
        if (lorePool.length) {
          var pick = lorePool[Math.floor(Math.random() * lorePool.length)]
          _loreUsed[pick] = true
          return Promise.resolve({ text: pick, state: 'talk', duration: 6000, intent: 'lore' })
        }
        return Promise.resolve({ text: '...', state: 'talk', duration: 3000, intent: 'lore' })
      }

      var reply = pickReply(intent)
      return Promise.resolve({ text: reply, state: 'talk', duration: 5000, intent: intent })
    })
  }

  // Auto-trigger: comment on collection state
  function autoComment() {
    loadCorpus().then(function () {
      // Read cockpit signals from DOM
      var fixCount = parseInt((document.getElementById('signal-fix-count') || {}).textContent) || 0
      var qualifyCount = parseInt((document.getElementById('signal-qualify-count') || {}).textContent) || 0
      var totalEl = document.getElementById('stat-total')
      var total = parseInt((totalEl || {}).textContent) || 0

      var reply
      if (total === 0) {
        reply = pickReply('collection_empty')
      } else if (fixCount > 0) {
        reply = pickReply('signal_fix').replace(/__COUNT__/g, String(fixCount))
      } else if (qualifyCount > 0) {
        reply = pickReply('signal_qualify').replace(/__COUNT__/g, String(qualifyCount))
      } else {
        reply = pickReply('collection_healthy')
      }

      if (window.BAZ && window.BAZ.say) {
        window.BAZ.say(reply, 5000)
      }
    })
  }

  // Listen for collection events
  document.addEventListener('rdx:collection-signal', function (e) {
    var type = e.detail && e.detail.type
    var count = e.detail && e.detail.count
    if (!type || !_corpus) return

    var category = 'signal_' + type.replace(/_/g, '_')
    if (!_corpus[category]) category = 'unknown'

    var reply = pickReply(category).replace(/__COUNT__/g, String(count || 0))
    if (window.BAZ && window.BAZ.say) {
      window.BAZ.say(reply, 4000)
    }
  })

  document.addEventListener('rdx:collection-qualify', function () {
    if (!_corpus) return
    var reply = pickReply('qualification_saved')
    if (window.BAZ && window.BAZ.say) {
      window.BAZ.say(reply, 3000)
    }
  })

  // Initialize: swap character + auto-comment after data loads
  function init() {
    if (!window.BAZ || !window.BAZ.setCharacter) {
      setTimeout(init, 500)
      return
    }

    window.BAZ.setCharacter({
      name: 'ERUDIT',
      portrait: '/assets/erudit/erudit-portrait.png',
      label: '...',
      placeholder: '...',
      cssClass: 'codec-char-erudit',
    })

    // Replace the ask engine
    window.BAZ._askEngine = ask

    // Auto-comment after cockpit loads (wait for signals)
    var key = 'rdx-erudit-greeted'
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      setTimeout(autoComment, 4000)
    }
  }

  // Wait for DOM + BAZ
  if (document.readyState === 'complete') {
    init()
  } else {
    window.addEventListener('load', function () { setTimeout(init, 1000) })
  }
})()
