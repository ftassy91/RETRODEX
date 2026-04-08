'use strict'

;(() => {
  const STORAGE_KEY = 'retrodex:runtime-log'
  const MAX_ENTRIES = 30

  function now() {
    if (window.performance?.now) {
      return window.performance.now()
    }
    return Date.now()
  }

  function readLog() {
    try {
      const raw = window.sessionStorage?.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (_error) {
      return []
    }
  }

  function writeLog(entry) {
    try {
      const next = readLog()
      next.unshift(entry)
      window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_ENTRIES)))
    } catch (_error) {}
  }

  function createPageMonitor(page) {
    const startedAt = now()
    const marks = []

    function mark(label, extra = null) {
      marks.push({
        label,
        at: Math.round(now() - startedAt),
        extra: extra || undefined,
      })
    }

    function finish(status, extra = null) {
      const entry = {
        page,
        status,
        durationMs: Math.round(now() - startedAt),
        marks,
        timestamp: new Date().toISOString(),
        extra: extra || undefined,
      }
      writeLog(entry)
      if (status === 'error') {
        console.warn(`[RetroDex][runtime] ${page} failed`, entry)
      } else {
        console.info(`[RetroDex][runtime] ${page} ${status}`, entry)
      }
    }

    return {
      mark,
      success(extra = null) {
        finish('ok', extra)
      },
      fail(error) {
        finish('error', {
          message: error?.message || String(error || 'unknown error'),
        })
      },
    }
  }

  window.RetroDexRuntimeMonitor = {
    createPageMonitor,
    readLog,
  }
})()
