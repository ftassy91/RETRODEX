'use strict'

fetch('/api/stats')
  .then((r) => r.json())
  .then((d) => {
    document.getElementById('s-games').textContent = d.total_games ? String(d.total_games) : '-'
    document.getElementById('s-consoles').textContent = d.total_platforms ? String(d.total_platforms) : '-'
    const avgLoose = d.price_stats?.avg_loose
    document.getElementById('s-meta').textContent = avgLoose ? `$${Math.round(avgLoose)}` : '-'
  })
  .catch(() => {})

fetch('/api/collection')
  .then((r) => r.json())
  .then((d) => {
    document.getElementById('s-coll').textContent = d.total ? String((d.items || []).length) : '0'
  })
  .catch(() => {})
