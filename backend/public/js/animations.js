/* ============================================================
   animations.js — Quiet Phosphor micro-interactions
   Rolling counters, typewriter h1, loading dots
   ============================================================ */

// === ROLLING COUNTER ===
// Usage: rollTo(element, 507, 600)
// Only animates integer values. Non-numeric targets are set directly.
function rollTo(el, target, ms) {
  if (!el) return
  ms = ms || 600
  var numeric = parseInt(target, 10)
  if (!isFinite(numeric) || String(target).indexOf('--') >= 0) {
    el.textContent = String(target)
    return
  }
  var start = performance.now()
  var from = parseInt(el.textContent, 10) || 0
  ;(function tick(now) {
    var t = Math.min((now - start) / ms, 1)
    var ease = 1 - Math.pow(1 - t, 3)
    el.textContent = Math.round(from + (numeric - from) * ease)
    if (t < 1) requestAnimationFrame(tick)
  })(start)
}

// === TYPEWRITER ===
// Elements with class "type-in" get typed once per session.
// Subsequent visits in the same session show the text instantly.
document.addEventListener('DOMContentLoaded', function () {
  var els = document.querySelectorAll('.type-in')
  if (!els.length) return

  var key = 'rdx-typed-' + location.pathname
  if (sessionStorage.getItem(key)) return

  els.forEach(function (el) {
    var text = el.textContent
    if (!text) return
    el.textContent = ''
    el.style.borderRight = '2px solid var(--accent, #00ff66)'
    var i = 0
    var iv = setInterval(function () {
      el.textContent += text[i++]
      if (i >= text.length) {
        clearInterval(iv)
        setTimeout(function () { el.style.borderRight = 'none' }, 800)
      }
    }, 40)
  })

  sessionStorage.setItem(key, '1')
})

// === LOADING DOTS ===
// Elements with class "loading-dots" get animated trailing dots via CSS.
// The element text should NOT include trailing dots — they are added by CSS.
;(function () {
  var s = document.createElement('style')
  s.textContent = [
    '.loading-dots::after {',
    '  content: ".";',
    '  animation: rdx-dots 1.5s steps(3, end) infinite;',
    '}',
    '@keyframes rdx-dots {',
    '  33% { content: ".."; }',
    '  66% { content: "..."; }',
    '}'
  ].join('\n')
  document.head.appendChild(s)
})()
