'use strict'

async function fetchConsolePayload(id) {
  const response = await fetch(`/api/consoles/${encodeURIComponent(id)}`)
  const payload = await response.json()
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }
  return payload
}

async function loadConsoleDetailPage() {
  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')
  const rootEl = document.getElementById('console-detail-root')

  if (!rootEl) {
    return
  }

  if (!id) {
    rootEl.innerHTML = '<div class="console-detail-empty">Console introuvable.</div>'
    return
  }

  const payload = await fetchConsolePayload(id)
  document.title = `${payload.console?.name || 'Console'} | RetroDex`
  await window.RetroDexConsoleSurface.renderConsoleSurface(rootEl, payload, {
    showBreadcrumb: true,
  })
}

loadConsoleDetailPage().catch((error) => {
  console.error('[console-detail]', error)
  const rootEl = document.getElementById('console-detail-root')
  if (rootEl) {
    rootEl.innerHTML = '<div class="console-detail-empty">Erreur de chargement.</div>'
  }
})
