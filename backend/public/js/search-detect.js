/* ============================================================
   search-detect.js — Intercept search bars for conversational input
   If user types a question → open codec instead of searching
   ============================================================ */

;(function () {
  'use strict'

  var QUESTION_PATTERNS = /\?|^(quoi|comment|pourquoi|qu.est.ce|aide|pense|nouvelle|aujourd.hui|explique|c.est quoi|qui est|on fait|par ou|combien|qu.est|raconte|donne|dis.moi)/i
  var CONVERSATIONAL_WORDS = ['quoi', 'comment', 'pourquoi', 'aide', 'pense', 'explique', 'raconte', 'conseil', 'avis', 'opinion', 'nouvelle', 'salut', 'bonjour', 'merci']

  function isConversational(text) {
    var trimmed = (text || '').trim()
    if (!trimmed || trimmed.length < 3) return false
    if (QUESTION_PATTERNS.test(trimmed)) return true

    var lower = trimmed.toLowerCase()
    for (var i = 0; i < CONVERSATIONAL_WORDS.length; i++) {
      if (lower.indexOf(CONVERSATIONAL_WORDS[i]) === 0) return true
    }
    return false
  }

  // Find all search inputs on the page (every page has different IDs)
  function getSearchInputs() {
    return [
      document.getElementById('hub-search-input'),         // hub.html
      document.getElementById('global-search'),             // games-list, consoles
      document.getElementById('dex-search-input'),          // encyclopedia
      document.getElementById('search-router-input'),       // search.html
      document.getElementById('franchise-search'),          // franchises
      document.getElementById('collection-search-input'),   // collection
      document.getElementById('query'),                     // games-list alt, debug
      document.querySelector('.surface-query-shell input[type="text"]'),
      document.querySelector('.terminal-query-line input'),
      document.querySelector('input[type="search"]'),
    ].filter(Boolean)
  }

  function handleSearchSubmit(e) {
    var input = e.target
    var text = (input.value || '').trim()
    if (!text) return

    if (isConversational(text)) {
      e.preventDefault()
      e.stopPropagation()
      input.value = ''

      // Open codec and send to BAZ
      if (window.BAZ && window.BAZ._askEngine) {
        // Play first encounter if needed
        if (window.BAZ.playFirstEncounter && window.BAZ.playFirstEncounter()) {
          // First encounter playing, queue the actual question
          setTimeout(function () {
            window.BAZ._askEngine(text).then(function (result) {
              if (result && result.text && window.BAZ.say) {
                window.BAZ.say(result.text, result.duration, result.state === 'content')
              }
            })
          }, 8000)
        } else {
          window.BAZ._askEngine(text).then(function (result) {
            if (result && result.text && window.BAZ.say) {
              window.BAZ.say(result.text, result.duration, result.state === 'content')
            }
          })
        }
      }
    }
  }

  // Placeholder hint — change once per session after 30s
  function scheduleHint() {
    var key = 'rdx-search-hint-shown'
    if (sessionStorage.getItem(key)) return

    setTimeout(function () {
      var inputs = getSearchInputs()
      if (!inputs.length) return

      var input = inputs[0]
      var original = input.placeholder
      input.placeholder = location.pathname.includes('collection')
        ? 'Filtrer... ou demander conseil'
        : 'Rechercher... ou poser une question'

      sessionStorage.setItem(key, '1')

      setTimeout(function () {
        input.placeholder = original
      }, 5000)
    }, 30000)
  }

  // Bind — intercept both keydown Enter and form submit
  document.addEventListener('DOMContentLoaded', function () {
    var inputs = getSearchInputs()
    inputs.forEach(function (input) {
      // Intercept Enter key
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var text = (input.value || '').trim()
          if (text && isConversational(text)) {
            e.preventDefault()
            e.stopPropagation()
            handleSearchSubmit(e)
          }
        }
      })

      // Also intercept form submit if input is inside a form
      var form = input.closest('form')
      if (form) {
        form.addEventListener('submit', function (e) {
          var text = (input.value || '').trim()
          if (text && isConversational(text)) {
            e.preventDefault()
            e.stopPropagation()
            handleSearchSubmit({ target: input, preventDefault: function(){}, stopPropagation: function(){} })
          }
        })
      }
    })

    scheduleHint()
  })
})()
