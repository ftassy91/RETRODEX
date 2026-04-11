/* ============================================================
   erudit-engine.js — L'Erudit: collection page character
   Patience gauge, localStorage memory, strategic intents.
   No auto-trigger. "..." never speaks first.
   ============================================================ */

;(function () {
  'use strict'

  if (!location.pathname.includes('collection')) return

  var _corpus = null
  var _loaded = false
  var _lastReplies = {}
  var _loreUsed = {}

  // Patience gauge
  var _patience = 15
  var _cooldownUntil = 0
  var PATIENCE_COST = {
    precise: -1,
    vague: -3,
    repeat: -5,
    name_ask: -5,
    unknown: -3,
    good_action: 2,
  }

  // Memory (unified bazMemory)
  function loadMemory() {
    if (window.bazMemory) return window.bazMemory.load().erudit
    return createMemory()
  }

  function createMemory() {
    return { interactions: [], collectionSnapshot: null, firstVisit: null, visitCount: 0, lastVisit: null }
  }

  function saveMemory() {
    if (window.bazMemory) window.bazMemory.save()
  }

  function recordVisit() {
    var mem = loadMemory()
    if (!mem.firstVisit) mem.firstVisit = new Date().toISOString()
    mem.visitCount = (mem.visitCount || 0) + 1
    mem.lastVisit = new Date().toISOString()
    saveMemory()
    return mem
  }

  function recordInteraction(user, erudit, intent) {
    var mem = loadMemory()
    mem.interactions.push({ user: user, erudit: erudit, intent: intent, ts: Date.now() })
    if (mem.interactions.length > 20) mem.interactions = mem.interactions.slice(-20)
    saveMemory()
  }

  function wasRecentlyAsked(text) {
    var mem = loadMemory()
    var lower = (text || '').toLowerCase()
    return mem.interactions.some(function (e) {
      return e.user && e.user.toLowerCase().indexOf(lower) !== -1 && (Date.now() - e.ts) < 300000
    })
  }

  function updateCollectionSnapshot(stats) {
    var mem = loadMemory()
    var prev = mem.collectionSnapshot
    mem.collectionSnapshot = {
      count: stats.total_items || 0,
      value: stats.total_value_loose || 0,
      qualified: (stats.total_medium || 0) + (stats.total_high || 0),
      lastChange: new Date().toISOString(),
    }
    saveMemory()
    return prev
  }

  // Corpus
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

  // Keywords
  var KEYWORDS = {
    signal_fix: ['corriger', 'doublon', 'fix', 'erreur', 'probleme'],
    signal_qualify: ['qualifier', 'qualification', 'completude', 'region', 'incomplet'],
    signal_sell: ['vendre', 'vente', 'sell', 'plus-value', 'benefice'],
    signal_upgrade: ['upgrade', 'upgrader', 'ameliorer', 'cib', 'loose vers'],
    signal_opportunity: ['acheter', 'achat', 'saisir', 'opportunite', 'wishlist'],
    signal_stale: ['stagnant', 'stale', 'dormant', 'wishlist vieille'],
    daily_plan: ['on fait quoi', 'aujourd\'hui', 'quoi faire', 'par ou', 'commencer', 'priorite'],
    whats_new: ['quoi de neuf', 'nouvelles', 'news', 'change', 'evolue'],
    opinion: ['tu penses quoi', 'ton avis', 'qu\'est-ce que tu en penses', 'verdict'],
    help: ['aide', 'help', '/help', 'quoi', 'comment'],
    lore: ['qui', 'nom', 'appelle', 'origine', 'd\'ou', 'viens', 'baz', 'petit', 'autre'],
    about_baz: ['baz', 'le petit', 'le guide'],
  }

  function parseIntent(text) {
    var lower = (text || '').toLowerCase().trim()
    if (!lower) return { intent: 'unknown', cost: 'vague' }

    // Name ask
    if (/ton nom|comment tu t.appelles|qui es.tu/.test(lower)) {
      return { intent: 'lore', cost: 'name_ask' }
    }

    // Lore
    for (var i = 0; i < KEYWORDS.lore.length; i++) {
      if (lower.indexOf(KEYWORDS.lore[i]) !== -1) return { intent: 'lore', cost: 'precise' }
    }

    // Strategic intents
    for (var intent in KEYWORDS) {
      if (intent === 'lore') continue
      var kws = KEYWORDS[intent]
      for (var k = 0; k < kws.length; k++) {
        if (lower.indexOf(kws[k]) !== -1) return { intent: intent, cost: 'precise' }
      }
    }

    // Check if repeat
    if (wasRecentlyAsked(lower)) return { intent: 'unknown', cost: 'repeat' }

    return { intent: 'unknown', cost: 'vague' }
  }

  function fetchCollectionContext() {
    var api = window.RetroDexApi
    if (!api || !api.fetchJson) return Promise.resolve(null)
    return api.fetchJson('/api/baz/context/collection').catch(function () { return null })
  }

  function ask(text) {
    // Cooldown check
    if (Date.now() < _cooldownUntil) {
      return Promise.resolve({ text: '', state: 'idle', duration: 0, intent: 'blocked' })
    }

    return loadCorpus().then(function () {
      var parsed = parseIntent(text)

      // Apply patience cost
      var cost = PATIENCE_COST[parsed.cost] || -2
      _patience += cost

      // Patience depleted → hang up
      if (_patience <= 0) {
        var hangupReply = pickReply('hangup')
        _cooldownUntil = Date.now() + 30000 + Math.random() * 30000
        _patience = 15

        recordInteraction(text, hangupReply || '[HANGUP]', 'hangup')

        if (!hangupReply) {
          // Silent hangup
          setTimeout(function () { if (window.BAZ) window.BAZ.slamClose() }, 500)
          return Promise.resolve({ text: '', state: 'idle', duration: 0, intent: 'hangup' })
        }

        return Promise.resolve({ text: hangupReply, state: 'talk', duration: 3000, intent: 'hangup', afterSay: function () {
          setTimeout(function () { if (window.BAZ) window.BAZ.slamClose() }, 3500)
        }})
      }

      // Lore — one-time fragments
      if (parsed.intent === 'lore') {
        var lorePool = (_corpus.lore || []).filter(function (r) { return !_loreUsed[r] })
        if (lorePool.length) {
          var pick = lorePool[Math.floor(Math.random() * lorePool.length)]
          _loreUsed[pick] = true
          recordInteraction(text, pick, 'lore')
          return Promise.resolve({ text: pick, state: 'talk', duration: 6000, intent: 'lore' })
        }
        recordInteraction(text, '...', 'lore')
        return Promise.resolve({ text: '...', state: 'talk', duration: 3000, intent: 'lore' })
      }

      // Strategic intents that need context
      if (parsed.intent === 'daily_plan' || parsed.intent === 'whats_new' || parsed.intent === 'opinion') {
        return fetchCollectionContext().then(function (ctx) {
          var reply = pickReply(parsed.intent)
          if (ctx) {
            reply = reply
              .replace(/X/g, String(ctx.total_items || 0))
              .replace(/Y/g, String(Math.max(0, (ctx.total_items || 0) - (ctx.total_medium || 0) - (ctx.total_high || 0))))
              .replace(/Z/g, String(ctx.delta || 0))
          }
          recordInteraction(text, reply, parsed.intent)
          return { text: reply, state: 'talk', duration: 5000, intent: parsed.intent }
        })
      }

      // Good action
      if (parsed.intent === 'qualification_saved') {
        _patience += PATIENCE_COST.good_action
      }

      var reply = pickReply(parsed.intent)
      recordInteraction(text, reply, parsed.intent)
      return Promise.resolve({ text: reply, state: 'talk', duration: 5000, intent: parsed.intent })
    })
  }

  // Listen for collection events
  document.addEventListener('rdx:collection-signal', function (e) {
    if (Date.now() < _cooldownUntil || !_corpus) return
    var type = e.detail && e.detail.type
    var count = e.detail && e.detail.count
    if (!type) return

    var category = 'signal_' + type
    if (!_corpus[category]) category = 'unknown'
    var reply = pickReply(category).replace(/__COUNT__/g, String(count || 0))
    if (window.BAZ && window.BAZ.say) window.BAZ.say(reply, 4000)
  })

  document.addEventListener('rdx:collection-qualify', function () {
    if (Date.now() < _cooldownUntil || !_corpus) return
    _patience += PATIENCE_COST.good_action
    var reply = pickReply('qualification_saved')
    if (window.BAZ && window.BAZ.say) window.BAZ.say(reply, 3000)
  })

  // Init — swap character, NO auto-trigger
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

    window.BAZ._askEngine = ask
    recordVisit()
  }

  if (document.readyState === 'complete') {
    init()
  } else {
    window.addEventListener('load', function () { setTimeout(init, 1000) })
  }
})()
