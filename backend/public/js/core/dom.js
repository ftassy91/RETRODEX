'use strict'

;(() => {
  function byId(id) {
    return document.getElementById(id)
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector)
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector))
  }

  function setText(node, value) {
    if (node) {
      node.textContent = value == null ? '' : String(value)
    }
  }

  function setHtml(node, html) {
    if (node) {
      node.innerHTML = html || ''
    }
  }

  window.RetroDexDom = {
    byId,
    qs,
    qsa,
    setText,
    setHtml,
  }
})()
