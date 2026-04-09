'use strict'

;(() => {
  function compactText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim()
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function formatCurrency(value, fallback, currency) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
      return fallback == null ? '-' : String(fallback)
    }
    const rounded = Math.round(number)
    if (currency === 'EUR') return `\u20AC${rounded}`
    if (currency === 'USD') return `$${rounded}`
    if (currency) return `${rounded} ?`
    return `$${rounded}`
  }

  function toArray(value) {
    return Array.isArray(value) ? value : []
  }

  window.RetroDexFormat = {
    compactText,
    escapeHtml,
    formatCurrency,
    toArray,
  }
})()
