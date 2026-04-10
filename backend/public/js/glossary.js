/* ============================================================
   glossary.js — BAZ tooltip system for retrogaming terms
   Hover = mini-tooltip, Click = BAZ speaks in codec
   ============================================================ */

;(function () {
  'use strict'

  var _glossary = null
  var _loading = null
  var _tipEl = null
  var _hintShown = false

  function loadGlossary() {
    if (_glossary) return Promise.resolve(_glossary)
    if (_loading) return _loading

    _loading = fetch('/assets/baz/glossary.json')
      .then(function (r) { return r.ok ? r.json() : {} })
      .then(function (data) { _glossary = data; _loading = null; return data })
      .catch(function () { _glossary = {}; _loading = null; return {} })

    return _loading
  }

  function createTip() {
    if (_tipEl) return _tipEl
    _tipEl = document.createElement('div')
    _tipEl.className = 'rdx-gloss-tip'
    _tipEl.setAttribute('role', 'tooltip')
    _tipEl.style.display = 'none'
    document.body.appendChild(_tipEl)
    return _tipEl
  }

  function showTip(target, text) {
    var tip = createTip()
    tip.textContent = text
    tip.style.display = 'block'

    var rect = target.getBoundingClientRect()
    var tipRect = tip.getBoundingClientRect()
    var left = rect.left + rect.width / 2 - tipRect.width / 2
    var top = rect.top - tipRect.height - 6

    if (left < 8) left = 8
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8
    if (top < 4) top = rect.bottom + 6

    tip.style.left = left + 'px'
    tip.style.top = top + window.scrollY + 'px'
  }

  function hideTip() {
    if (_tipEl) _tipEl.style.display = 'none'
  }

  // First-time hint via BAZ
  function showGlossHint() {
    if (_hintShown || sessionStorage.getItem('rdx-gloss-hint')) return
    _hintShown = true
    sessionStorage.setItem('rdx-gloss-hint', '1')
    if (window.BAZ && window.BAZ.say) {
      setTimeout(function () {
        window.BAZ.say('Les termes soulignes sont cliquables. Je t\'explique.', 4000)
      }, 3000)
    }
  }

  // Preload glossary on page load (so baz-engine can use it synchronously)
  if (document.readyState === 'complete') {
    loadGlossary()
  } else {
    window.addEventListener('load', function () { setTimeout(loadGlossary, 1000) })
  }

  // Event delegation
  document.addEventListener('mouseenter', function (e) {
    var target = e.target.closest('[data-rdx-term]')
    if (!target) return

    var term = target.dataset.rdxTerm
    loadGlossary().then(function (g) {
      var entry = g[term]
      if (!entry) return
      showTip(target, entry.short)
      showGlossHint()
    })
  }, true)

  document.addEventListener('mouseleave', function (e) {
    if (e.target.closest('[data-rdx-term]')) hideTip()
  }, true)

  // Click = BAZ speaks the long definition
  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-rdx-term]')
    if (!target) return

    var term = target.dataset.rdxTerm
    loadGlossary().then(function (g) {
      var entry = g[term]
      if (!entry || !entry.long) return
      hideTip()
      if (window.BAZ && window.BAZ.say) {
        window.BAZ.say(entry.long, 6000, true)
      }
    })
  })

  // Touch fallback (no hover on mobile)
  document.addEventListener('touchstart', function (e) {
    var target = e.target.closest('[data-rdx-term]')
    if (!target) return

    var term = target.dataset.rdxTerm
    loadGlossary().then(function (g) {
      var entry = g[term]
      if (!entry) return
      if (window.BAZ && window.BAZ.say) {
        window.BAZ.say(entry.long || entry.short, 5000, true)
      }
    })
  }, { passive: true })

  window.RDXGlossary = {
    load: loadGlossary,
    get _cache() { return _glossary },
  }
})()
