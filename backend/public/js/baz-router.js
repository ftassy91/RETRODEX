/* ============================================================
   baz-router.js — Unified BAZ routing layer

   Single entry point for ALL BAZ/Erudit interactions.
   Every module (codec, search-detect, glossary, erudit) routes
   through here instead of having its own logic.

   Load order: codec.js → baz-router.js → glossary/search-detect → baz-kb → baz-gen → baz-engine → erudit-engine
   ============================================================ */

;(function () {
  'use strict'

  // ── Context detection ──────────────────────────────────────

  function getPageContext() {
    var path = location.pathname
    return {
      page: path,
      isCollection: path.includes('collection'),
      isGameDetail: path.includes('game-detail'),
      isHub: path === '/' || path.includes('hub') || path.includes('home'),
      isIndex: path.includes('games-list'),
    }
  }

  function getActiveCharacter() {
    return getPageContext().isCollection ? 'erudit' : 'baz'
  }

  // ── Unified ask ────────────────────────────────────────────
  // This is THE single function that processes user input.
  // All entry points (codec, search bar, glossary, events) call this.

  function route(text, options) {
    options = options || {}
    var source = options.source || 'codec'    // codec | search | glossary | event
    var context = getPageContext()
    var character = getActiveCharacter()

    // 1. Route to the appropriate engine (glossary hints flow through pipeline)
    var engine = window.BAZ && window.BAZ._askEngine
    if (!engine) {
      // No engine loaded — use BAZ.say as last resort
      return Promise.resolve({
        text: text || '...',
        state: 'talk',
        duration: 3000,
        intent: 'fallback',
        character: character,
        source: 'fallback',
      })
    }

    // 2. Call the engine with options (baz-engine or erudit-engine depending on page)
    var engineOptions = {}
    if (options.glossaryEntry) engineOptions.glossaryEntry = options.glossaryEntry

    return engine(text, engineOptions).then(function (result) {
      result = result || {}
      result.character = character
      result.source = source
      return result
    }).catch(function () {
      return {
        text: 'Hmm. Signal perdu.',
        state: 'talk',
        duration: 3000,
        intent: 'error',
        character: character,
        source: 'error',
      }
    })
  }

  // ── Display ────────────────────────────────────────────────
  // Unified display: route result → codec display

  function display(result) {
    if (!result || !result.text) return

    if (window.BAZ && window.BAZ.say) {
      window.BAZ.say(result.text, result.duration || 5000, result.state === 'content')
    }

    // Handle afterSay callback (erudit hangup)
    if (result.afterSay && typeof result.afterSay === 'function') {
      result.afterSay()
    }
  }

  // ── Convenience: route + display ───────────────────────────

  function ask(text, options) {
    return route(text, options).then(function (result) {
      display(result)
      return result
    })
  }

  // ── First encounter check ──────────────────────────────────

  function checkFirstEncounter() {
    if (window.BAZ && window.BAZ.playFirstEncounter) {
      return window.BAZ.playFirstEncounter()
    }
    return false
  }

  // ── Expose ─────────────────────────────────────────────────

  window.BAZRouter = {
    route: route,         // route only (returns promise with result, no display)
    display: display,     // display only (takes result, shows in codec)
    ask: ask,             // route + display (convenience)
    getPageContext: getPageContext,
    getActiveCharacter: getActiveCharacter,
    checkFirstEncounter: checkFirstEncounter,
  }
})()
