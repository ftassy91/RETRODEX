'use strict'

const statusEl = document.getElementById('completion-status')
const originEl = document.getElementById('completion-origin')
const overviewEl = document.getElementById('completion-overview')
const bandsEl = document.getElementById('completion-bands')
const familiesEl = document.getElementById('completion-families')
const rankingsEl = document.getElementById('completion-field-rankings')
const blockedEl = document.getElementById('completion-blocked')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

function statusClass(status) {
  return `is-${String(status || 'weak').replaceAll('_', '-')}`
}

function renderStatusBadge(status, label = null) {
  const text = label || String(status || 'weak').replaceAll('_', ' ')
  return `<span class="completion-status-badge ${statusClass(status)}">${escapeHtml(text)}</span>`
}

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    return response.json()
  })
}

function renderOverview(summary = {}) {
  if (!overviewEl) return

  const items = [
    { label: 'Catalog games', value: summary.total_games || 0 },
    { label: 'Top1200', value: summary.top1200_games || 0 },
    { label: 'Long tail', value: summary.long_tail_games || 0 },
    { label: 'Strong fields', value: summary.strong_fields || 0 },
    { label: 'Weak fields', value: summary.weak_fields || 0 },
    { label: 'Avg audit', value: `${Number(summary.avg_overall_score || 0).toFixed(1)}/100` },
  ]

  overviewEl.innerHTML = items.map((item) => `
    <article class="outlier-stat">
      <div class="outlier-stat-value">${escapeHtml(item.value)}</div>
      <div class="outlier-stat-label">${escapeHtml(item.label)}</div>
    </article>
  `).join('')
}

function renderBands(bands = []) {
  if (!bandsEl) return

  bandsEl.innerHTML = bands.map((band) => `
    <article class="card completion-card">
      <div class="completion-card-head">
        <div>
          <strong>${escapeHtml(band.label)}</strong>
          <div class="muted">${escapeHtml(band.game_count)} jeux</div>
        </div>
        <div class="surface-chip-row">
          ${renderStatusBadge('strong', `Strong ${band.status_counts?.strong || 0}`)}
          ${renderStatusBadge('close', `Close ${band.status_counts?.close || 0}`)}
          ${renderStatusBadge('weak', `Weak ${band.status_counts?.weak || 0}`)}
          ${renderStatusBadge('blocked_by_source', `Blocked ${band.status_counts?.blocked_by_source || 0}`)}
        </div>
      </div>
      <div class="completion-table">
        <div class="completion-row is-head">
          <span>Famille</span>
          <span>Couv.</span>
          <span>Cible</span>
          <span>Etat</span>
        </div>
        ${(band.family_scores || []).map((family) => `
          <div class="completion-row">
            <span>${escapeHtml(family.label)}</span>
            <span>${escapeHtml(formatPercent(family.coverage_pct))}</span>
            <span>${escapeHtml(formatPercent(family.target_pct))}</span>
            <span>${renderStatusBadge(family.status, family.status_label)}</span>
          </div>
        `).join('')}
      </div>
      <div class="completion-card-footer">
        Top gaps :
        ${(band.top_gaps || []).slice(0, 3).map((field) => escapeHtml(field.label)).join(' | ') || 'n/a'}
      </div>
    </article>
  `).join('')
}

function renderFamilies(families = []) {
  if (!familiesEl) return

  familiesEl.innerHTML = families.map((family) => `
    <article class="card completion-card">
      <div class="completion-card-head">
        <div>
          <strong>${escapeHtml(family.label)}</strong>
          <div class="muted">${escapeHtml(family.field_count || 0)} champs suivis</div>
        </div>
        ${renderStatusBadge(family.status, family.status_label)}
      </div>
      <div class="completion-family-metrics">
        <div><span class="muted">Couverture</span><br />${escapeHtml(formatPercent(family.coverage_pct))}</div>
        <div><span class="muted">Cible</span><br />${escapeHtml(formatPercent(family.target_pct))}</div>
        <div><span class="muted">Gap</span><br />${escapeHtml(family.gap_to_target || 0)}</div>
        <div><span class="muted">Filled</span><br />${escapeHtml(family.filled_count || 0)}</div>
      </div>
    </article>
  `).join('')
}

function renderRankings(fields = []) {
  if (!rankingsEl) return

  rankingsEl.innerHTML = fields.slice(0, 10).map((field) => `
    <article class="card completion-card">
      <div class="completion-card-head">
        <div>
          <strong>${escapeHtml(field.label)}</strong>
          <div class="muted">${escapeHtml(field.family_label || field.family || 'n/a')}</div>
        </div>
        ${renderStatusBadge(field.status, field.status_label)}
      </div>
      <div class="completion-table">
        <div class="completion-row">
          <span>Couverture</span>
          <span>${escapeHtml(formatPercent(field.coverage_pct))}</span>
        </div>
        <div class="completion-row">
          <span>Cible</span>
          <span>${escapeHtml(formatPercent(field.target_pct || field.strong_target))}</span>
        </div>
        <div class="completion-row">
          <span>Gap</span>
          <span>${escapeHtml(field.gap_to_target || 0)}</span>
        </div>
        <div class="completion-row">
          <span>Blocked</span>
          <span>${escapeHtml(field.blocked_count || 0)}</span>
        </div>
      </div>
    </article>
  `).join('')
}

function renderBlocked(items = []) {
  if (!blockedEl) return

  if (!items.length) {
    blockedEl.innerHTML = `
      <article class="card completion-card">
        <strong>Blocages source</strong>
        <div class="summary">Aucun blocage source explicite n'est remonte dans les residus connus.</div>
      </article>
    `
    return
  }

  blockedEl.innerHTML = items.slice(0, 8).map((item) => `
    <article class="card completion-card">
      <div class="completion-card-head">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <div class="muted">${escapeHtml(item.count)} cas</div>
        </div>
        ${renderStatusBadge('blocked_by_source', 'Blocked')}
      </div>
      <div class="summary">
        ${(item.sample_titles || []).map((title) => escapeHtml(title)).join(' | ') || 'n/a'}
      </div>
      <div class="completion-card-footer">
        ${(item.reasons || []).slice(0, 2).map((reason) => `${escapeHtml(reason.reason)} (${escapeHtml(reason.count)})`).join(' | ') || 'raison non detaillee'}
      </div>
    </article>
  `).join('')
}

async function boot() {
  try {
    const payload = await fetchJson('/api/audit/completion')
    const overview = payload.overview || payload

    if (statusEl) {
      statusEl.innerHTML = `<strong>Completion active</strong><br />${escapeHtml(overview.summary?.tracked_fields || 0)} champs suivis | ${escapeHtml(overview.summary?.strong_fields || 0)} strong | ${escapeHtml(overview.summary?.blocked_fields || 0)} blocked`
    }
    if (originEl) {
      const sources = overview.sources || {}
      originEl.textContent = `Sources : audit=${sources.audit_summary ? 'ok' : 'n/a'} | top1200=${sources.top1200 ? 'ok' : 'n/a'} | sqlite=${sources.sqlite ? 'ok' : 'n/a'}`
    }

    renderOverview(overview.summary)
    renderBands(overview.bands)
    renderFamilies(overview.families)
    renderRankings(overview.field_rankings)
    renderBlocked(overview.blocked_by_source)
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = `Erreur completion : ${error.message}`
    }
    if (originEl) {
      originEl.textContent = 'Verification locale requise : la route admin de compl?tude doit etre disponible dans le runtime local.'
    }
    if (overviewEl) {
      overviewEl.innerHTML = `
        <article class="outlier-stat">
          <div class="outlier-stat-value">ERROR</div>
          <div class="outlier-stat-label">${escapeHtml(error.message)}</div>
        </article>
      `
    }
  }
}

boot().catch((error) => {
  console.error('[completion]', error)
})
