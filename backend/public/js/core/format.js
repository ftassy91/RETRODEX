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

  function formatCurrency(value, fallback) {
    const number = Number(value)
    if (!Number.isFinite(number)) {
      return fallback == null ? '-' : String(fallback)
    }
    return `$${Math.round(number)}`
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
