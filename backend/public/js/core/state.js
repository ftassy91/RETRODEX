'use strict'

;(() => {
  function getParams() {
    return new URLSearchParams(window.location.search)
  }

  function getParam(name) {
    return getParams().get(name) || ''
  }

  function replaceCurrentPath(pathname, params) {
    const nextPath = params && params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname
    window.history.replaceState({}, '', nextPath)
  }

  window.RetroDexState = {
    getParams,
    getParam,
    replaceCurrentPath,
  }
})()
